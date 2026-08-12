'use client'
import { useState, useEffect, useRef } from 'react'
import { usePolling } from '@/lib/usePolling'
import { fmtDate } from '@/lib/fmtDate'
import { Linkify } from '@/lib/linkify'
import SavedFlash from './SavedFlash'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'

type MeetingEntry = {
  id: number
  log_date: string
  notes: string | null
  photo_url: string | null
  logged_by: string
  created_at: string
  attendees: string[] | null
  start_time: string | null
  end_time: string | null
}

// Pulls "@Name: ..." markers out of a meeting note's free text -- each one
// becomes a candidate to push to that person's own page as a real task
// (their Times page already has a Tasks icon scoped to their name, see
// StaffPersonTab.tsx), so "@James: will restock the shelf" can become an
// actual follow-up on James' own page with one tap instead of staying text
// buried in someone else's minutes.
function parseMentions(notes: string, roster: string[]): { name: string; text: string }[] {
  const escaped = roster.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!escaped.length) return []
  const pattern = new RegExp(`@(${escaped.join('|')})\\s*:`, 'gi')
  const matches = [...notes.matchAll(pattern)]
  const out: { name: string; text: string }[] = []
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? notes.length) : notes.length
    const text = notes.slice(start, end).trim()
    const canonical = roster.find(n => n.toLowerCase() === m[1].toLowerCase()) ?? m[1]
    if (text) out.push({ name: canonical, text })
  })
  return out
}

async function postTask(submenu: string, title: string): Promise<boolean> {
  const res = await fetch('/api/tasks', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, submenu, view: '' }),
  }).catch(() => null)
  return !!res?.ok
}

function fmtTimeRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null
  const short = (t: string) => t.slice(0, 5)
  if (start && end) return `${short(start)}–${short(end)}`
  return short((start ?? end)!)
}

// One button per "@Name: ..." found in a note -- shared between the compose
// form's live preview and each saved entry in history, since sending
// someone's part to their own page doesn't need to happen at save time.
function MentionButtons({ notes, roster }: { notes: string; roster: string[] }) {
  const mentions = parseMentions(notes, roster)
  const [sent, setSent] = useState<Set<number>>(new Set())
  if (!mentions.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {mentions.map((m, i) => (
        <button key={i} type="button" disabled={sent.has(i)}
          onClick={async () => { const ok = await postTask(m.name, m.text); if (ok) setSent(prev => new Set(prev).add(i)) }}
          className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition ${sent.has(i) ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}>
          {sent.has(i) ? `✓ Sent to ${m.name}` : `Send to ${m.name} →`}
        </button>
      ))}
    </div>
  )
}

// Team Meeting's own richer log -- reuses the same manage_logs table/
// category as every other Grony Manage log ('staff_meeting', kept as-is
// since it's the persisted DB key, not a display label), but with
// attendees/start-end time on top of notes+photo, an @-mention picker that
// turns "@Name: ..." into a one-tap task on that person's own page, and a
// separate "discuss on another page" widget that does the same thing for a
// whole page instead of a person. Outgrew the generic ManageLogPanel, which
// is why it's its own component instead of another LOG_CATEGORIES entry.
export default function StaffMeetingPanel({ staffRoster, routablePages }: { staffRoster: string[]; routablePages: string[] }) {
  const [entries, setEntries] = useState<MeetingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const lawsPanel = useLawsPanel('showTeamMeetingLaws')
  const [notes, setNotes] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [routePage, setRoutePage] = useState('')
  const [routeText, setRouteText] = useState('')
  const [routeSaving, setRouteSaving] = useState(false)
  const [routeSent, setRouteSent] = useState(false)

  function load() {
    fetch('/api/manage-logs?category=staff_meeting')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  usePolling(load, 60000)

  function toggleAttendee(name: string) {
    setAttendees(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setNotes(val)
    const cursor = e.target.selectionStart ?? val.length
    const uptoCursor = val.slice(0, cursor)
    const atIndex = uptoCursor.lastIndexOf('@')
    if (atIndex === -1) { setMentionQuery(null); return }
    const between = uptoCursor.slice(atIndex + 1)
    if (/[\s\n]/.test(between)) { setMentionQuery(null); return }
    setMentionQuery(between)
  }

  function pickMention(name: string) {
    const cursor = textareaRef.current?.selectionStart ?? notes.length
    const uptoCursor = notes.slice(0, cursor)
    const atIndex = uptoCursor.lastIndexOf('@')
    if (atIndex === -1) return
    const before = notes.slice(0, atIndex)
    const after = notes.slice(cursor)
    const inserted = `@${name}: `
    setNotes(before + inserted + after)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      const pos = before.length + inserted.length
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(pos, pos)
    })
  }

  const mentionMatches = mentionQuery !== null
    ? staffRoster.filter(n => n.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : []

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/announcements/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setPhotoUrl(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!notes.trim() && !photoUrl) { setError('Add a note or a photo'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/manage-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'staff_meeting', notes: notes.trim() || null, photo_url: photoUrl,
          attendees, start_time: startTime || null, end_time: endTime || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save') }
      setNotes(''); setPhotoUrl(null); setAttendees([]); setStartTime(''); setEndTime('')
      load()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    await fetch(`/api/manage-logs?id=${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function sendRoute() {
    if (!routePage || !routeText.trim()) return
    setRouteSaving(true)
    const ok = await postTask(routePage, routeText.trim())
    setRouteSaving(false)
    if (ok) {
      setRouteSent(true)
      setRouteText('')
      setTimeout(() => setRouteSent(false), 2500)
    }
  }

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList scopeKey="Team Meeting" isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}

              activeFilters={lawsPanel.activeFilters} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">🗣️ Team Meeting</p>

        <div>
          <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Present</p>
          <div className="flex flex-wrap gap-1.5">
            {staffRoster.map(name => (
              <button key={name} type="button" onClick={() => toggleAttendee(name)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg border transition ${attendees.includes(name) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                {name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Start</p>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-1">End</p>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
          </div>
        </div>

        <div className="relative">
          <textarea ref={textareaRef} value={notes} onChange={handleNotesChange}
            placeholder="Meeting minutes… type @ to mention someone (e.g. @James: will restock the shelf)" rows={4}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
              {mentionMatches.map(n => (
                <button key={n} type="button" onClick={() => pickMention(n)}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-blue-50 transition">{n}</button>
              ))}
            </div>
          )}
        </div>
        <MentionButtons notes={notes} roster={staffRoster} />

        {photoUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
            <button onClick={() => setPhotoUrl(null)} className="text-[10px] text-red-500 font-semibold">Remove photo</button>
          </div>
        )}
        {error && <p className="text-[10px] text-red-500">{error}</p>}
        <div className="flex items-center gap-1.5">
          <label className="shrink-0 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer">
            {uploading ? 'Uploading…' : '📷 Photo'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
          <button onClick={save} disabled={saving || uploading || (!notes.trim() && !photoUrl)}
            className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
            {saving ? 'Saving…' : 'Save Minutes'}
          </button>
          <SavedFlash show={justSaved} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 space-y-1.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">📌 Discuss On Another Page</p>
        <div className="flex items-center gap-1.5">
          <select value={routePage} onChange={e => setRoutePage(e.target.value)}
            className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400">
            <option value="">Page…</option>
            {routablePages.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input value={routeText} onChange={e => setRouteText(e.target.value)} placeholder="What to discuss…"
            className="flex-1 min-w-0 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
        </div>
        <button onClick={sendRoute} disabled={routeSaving || !routePage || !routeText.trim()}
          className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
          {routeSaving ? 'Sending…' : routeSent ? `✓ Sent to ${routePage}` : `Send to ${routePage || 'page'} →`}
        </button>
      </div>

      {loading ? (
        <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No meetings logged yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {entries.map(e => (
            <div key={e.id} className="px-2.5 py-1.5 space-y-1">
              <div className="flex items-start gap-2">
                {e.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.photo_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] text-gray-400">
                    {fmtDate(e.log_date)}{fmtTimeRange(e.start_time, e.end_time) ? ` · ${fmtTimeRange(e.start_time, e.end_time)}` : ''} · <span className="capitalize">{e.logged_by}</span>
                  </p>
                  {!!e.attendees?.length && (
                    <p className="text-[9px] text-gray-500">Present: {e.attendees.join(', ')}</p>
                  )}
                  {e.notes && <Linkify text={e.notes} as="p" className="text-[11px] text-gray-800 whitespace-pre-wrap leading-snug" />}
                </div>
                {confirmDeleteId === e.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => remove(e.id)} className="text-[9px] font-bold text-white bg-red-600 rounded px-1.5 py-0.5">Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteId(e.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                )}
              </div>
              {e.notes && <MentionButtons notes={e.notes} roster={staffRoster} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
