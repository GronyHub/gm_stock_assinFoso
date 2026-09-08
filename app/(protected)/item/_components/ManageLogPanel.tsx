'use client'
import { useState, useEffect } from 'react'
import { usePolling } from '@/lib/usePolling'
import { fmtDate } from '@/lib/fmtDate'
import { Linkify } from '@/lib/linkify'
import SavedFlash from './SavedFlash'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'

type LogEntry = {
  id: number
  log_date: string
  notes: string | null
  photo_url: string | null
  logged_by: string
  created_at: string
  about_staff: string | null
}

// Most recent required equipment-check day (every Monday and Thursday) on
// or before today, as YYYY-MM-DD -- mirrors the same rule in
// /api/flags/route.ts (kept separate since that file is server-only).
function lastRequiredEquipmentCheckDate(): string {
  const today = new Date()
  const day = today.getDay()
  const sinceMonday = (day + 6) % 7
  const sinceThursday = (day + 3) % 7
  const daysSince = Math.min(sinceMonday, sinceThursday)
  const due = new Date(today)
  due.setDate(due.getDate() - daysSince)
  return due.toISOString().slice(0, 10)
}

// One reusable panel for every Grony Manage category that has no existing
// data behind it (Arrangement, Cleanliness, Future, Customer Display, Staff
// Display, Training, Repair Works, Quality Assurance) -- a simple dated log
// staff add notes/photos to, viewable as history over time. audio_jingle and
// audio_equipment_check use the same log but also carry an overdue flag
// (Jingle: nothing logged yet this month; Equipment: last logged entry is
// older than the most recent required Mon/Thu check).
export default function ManageLogPanel({
  category, label, icon, headerExtra, aboutStaffRoster, filterAboutStaff,
}: {
  category: string; label: string; icon: string; headerExtra?: React.ReactNode
  // Team-wide page only: offers an "About" picker on the entry form so a
  // behaviour/display note records WHICH staff member it concerns (as
  // opposed to `logged_by`, who wrote it) -- lets a personal page filter to
  // just that person's own entries instead of the full shared log.
  aboutStaffRoster?: string[]
  // Personal page only: restricts the list to entries about this one staff
  // member, and hides the add-entry composer (adding still happens from the
  // Team-wide page, where the "About" picker lives).
  filterAboutStaff?: string
}) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const lawsPanel = useLawsPanel(`showManageLogLaws_${category}`)
  const [notes, setNotes] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [aboutStaff, setAboutStaff] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  function load() {
    const url = filterAboutStaff
      ? `/api/manage-logs?category=${category}&about_staff=${encodeURIComponent(filterAboutStaff)}`
      : `/api/manage-logs?category=${category}`
    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [category, filterAboutStaff])
  usePolling(load, 600000)

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
    } catch (e: any) {
      setError(e.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!notes.trim() && !photoUrl) { setError('Add a note or a photo'); return }
    if (aboutStaffRoster && !aboutStaff) { setError('Choose who this is about'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/manage-logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, notes: notes.trim() || null, photo_url: photoUrl, about_staff: aboutStaff || null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save') }
      setNotes('')
      setPhotoUrl(null)
      setAboutStaff('')
      load()
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (e: any) {
      setError(e.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    await fetch(`/api/manage-logs?id=${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const monthStartStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  const jingleOverdue = category === 'audio_jingle' && !loading && !entries.some(e => e.log_date >= monthStartStr)
  const equipmentOverdue = category === 'audio_equipment_check' && !loading
    && (entries.length === 0 || entries[0].log_date < lastRequiredEquipmentCheckDate())

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
          <PageLawsList scopeKey={label} isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}

              activeFilters={lawsPanel.activeFilters} />
        </div>
      )}
      {headerExtra}
      {(jingleOverdue || equipmentOverdue) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-2.5 py-2 flex items-center gap-2">
          <span className="text-red-600 text-xs">🚩</span>
          <p className="text-[11px] text-red-700 font-semibold">
            {jingleOverdue ? 'No new jingle recorded yet this month.' : 'Equipment check not confirmed for the most recent Monday/Thursday.'}
          </p>
        </div>
      )}
      {!filterAboutStaff && (
        <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{icon} {label}</p>
          {aboutStaffRoster && (
            <select value={aboutStaff} onChange={e => setAboutStaff(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Who is this about?</option>
              {aboutStaffRoster.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder={`Notes about ${label.toLowerCase()}…`} rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
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
              {saving ? 'Saving…' : 'Add Entry'}
            </button>
            <SavedFlash show={justSaved} />
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">
          {filterAboutStaff ? `No ${label.toLowerCase()} entries about ${filterAboutStaff} yet.` : `No ${label.toLowerCase()} entries yet.`}
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {entries.map(e => (
            <div key={e.id} className="px-2.5 py-1.5 flex items-start gap-2">
              {e.photo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.photo_url} alt="" className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-gray-400">{fmtDate(e.log_date)} · <span className="capitalize">{e.logged_by}</span></p>
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
          ))}
        </div>
      )}
    </div>
  )
}
