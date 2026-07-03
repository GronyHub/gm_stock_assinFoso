'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import DayBookFeed from '@/components/DayBookFeed'

// ─── Announcements ────────────────────────────────────────────────────────────
type MediaItem = { url: string; type: string }
type Announcement = { id: number; author: string; body: string; media_urls: MediaItem[]; created_at: string }
type MediaFile = { file: File | Blob; localUrl: string; uploading: boolean; url?: string; contentType?: string; error?: string; kind: 'image' | 'video' | 'audio' }

function fmtRecTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function fmtAnnTime(iso: string) {
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHrs = Math.floor(diffMins / 60)
    if (diffHrs < 24) return `${diffHrs}h ago`
    const diffDays = Math.floor(diffHrs / 24)
    return `${diffDays}d ago`
  } catch { return '' }
}

function mediaKind(type: string): 'image' | 'video' | 'audio' {
  if (type.startsWith('video/')) return 'video'
  if (type.startsWith('audio/')) return 'audio'
  return 'image'
}

function MediaGrid({ items }: { items: MediaItem[] }) {
  if (!items.length) return null
  const audio = items.filter(m => mediaKind(m.type) === 'audio')
  const visual = items.filter(m => mediaKind(m.type) !== 'audio')
  return (
    <div className="mt-2 space-y-1">
      {visual.length > 0 && (
        <div className={`grid gap-1 ${visual.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {visual.map((m, i) => (
            mediaKind(m.type) === 'video' ? (
              <video key={i} src={m.url} controls className="w-full rounded-lg max-h-64 object-cover bg-black" />
            ) : (
              <a key={i} href={m.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full rounded-lg max-h-64 object-cover" />
              </a>
            )
          ))}
        </div>
      )}
      {audio.map((m, i) => (
        <audio key={i} src={m.url} controls className="w-full h-9" />
      ))}
    </div>
  )
}

function AnnouncementsPanel() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const canManage = ['owner', 'manager'].includes(role)

  const [posts, setPosts] = useState<Announcement[]>([])
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<MediaFile[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function load() {
    fetch('/api/announcements')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setPosts(d) })
      .catch(() => {})
  }

  useEffect(() => { load() }, [])
  usePolling(load, 15000)

  // Stop any in-progress recording if the panel unmounts mid-recording
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current)
    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop())
  }, [])

  async function uploadItem(item: MediaFile) {
    const fd = new FormData()
    fd.append('file', item.file)
    try {
      const res = await fetch('/api/announcements/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      setMedia(prev => prev.map(m =>
        m.localUrl === item.localUrl ? { ...m, uploading: false, url: data.url, contentType: data.contentType } : m
      ))
    } catch (e: any) {
      setMedia(prev => prev.map(m =>
        m.localUrl === item.localUrl ? { ...m, uploading: false, error: e.message } : m
      ))
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return
    const newItems: MediaFile[] = Array.from(files).map(file => ({
      file, localUrl: URL.createObjectURL(file), uploading: true, kind: mediaKind(file.type),
    }))
    setMedia(prev => [...prev, ...newItems])
    for (const item of newItems) uploadItem(item)
  }

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      recordedChunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(recordedChunksRef.current, { type: mimeType })
        const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `voice-note.${ext}`, { type: mimeType })
        const item: MediaFile = { file, localUrl: URL.createObjectURL(blob), uploading: true, kind: 'audio' }
        setMedia(prev => [...prev, item])
        uploadItem(item)
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
      recordTimerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000)
    } catch {
      setError('Could not access the microphone. Check your browser permissions.')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
  }

  function removeMedia(localUrl: string) {
    setMedia(prev => prev.filter(m => m.localUrl !== localUrl))
  }

  async function handlePost() {
    const stillUploading = media.some(m => m.uploading)
    if (stillUploading) { setError('Still uploading, please wait…'); return }
    const failedUploads = media.filter(m => m.error)
    if (failedUploads.length) { setError('Some files failed to upload. Remove them and try again.'); return }
    if (!body.trim() && media.length === 0) { setError('Add a message, voice note, or media.'); return }

    setPosting(true)
    setError('')
    try {
      const media_urls: MediaItem[] = media
        .filter(m => m.url)
        .map(m => ({ url: m.url!, type: m.contentType ?? m.file.type }))
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim(), media_urls }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setBody('')
      setMedia([])
      load()
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong')
    } finally {
      setPosting(false)
    }
  }

  async function removePost(id: number) {
    await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const canPost = !posting && !recording && (body.trim().length > 0 || media.length > 0) && !media.some(m => m.uploading)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">📢 Announcements</p>
        <p className="text-xs text-gray-400 mt-0.5">Share info with the team — replaces the WhatsApp group</p>
      </div>

      {/* Compose — owner/manager only, matches server-side posting permission */}
      {canManage && (
        <div className="px-4 py-3 border-b border-gray-100 space-y-2">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost() }}
            rows={3}
            placeholder="Write an announcement…"
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />

          {/* Media previews */}
          {media.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {media.map(m => (
                <div key={m.localUrl} className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100">
                  {m.kind === 'video' ? (
                    <video src={m.localUrl} className="w-full h-full object-cover" />
                  ) : m.kind === 'audio' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-2xl">🎤</div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.localUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  {m.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold">uploading…</span>
                    </div>
                  )}
                  {m.error && (
                    <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold text-center px-1">{m.error}</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeMedia(m.localUrl)}
                    className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center leading-none"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={recording}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition disabled:opacity-40"
              >
                📎 Photo / Video
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              {recording ? (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 px-2 py-1.5 rounded-lg animate-pulse"
                >
                  ⏹ Stop {fmtRecTime(recordSeconds)}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600 px-2 py-1.5 rounded-lg hover:bg-blue-50 transition"
                >
                  🎤 Voice
                </button>
              )}
            </div>
            <button
              onClick={handlePost}
              disabled={!canPost}
              className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No announcements yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {posts.map(p => (
            <div key={p.id} className="px-4 py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-700 capitalize">{p.author}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-gray-400">{fmtAnnTime(p.created_at)}</span>
                  {canManage && (
                    <button onClick={() => removePost(p.id)} className="text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                  )}
                </div>
              </div>
              {p.body && <p className="text-sm text-gray-800 whitespace-pre-wrap">{p.body}</p>}
              <MediaGrid items={p.media_urls ?? []} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const fmt = (v: any) => `₵${Number(v ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`

function Section({ title, href, linkLabel, children }: { title: string; children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{title}</p>
        {href && (
          <Link href={href} className="text-[10px] text-blue-600 font-semibold">
            {linkLabel ?? 'View →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function agePhrase(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'for 1 day now'
  return `for ${days} days now`
}

function oldestDays(rows: any[], field: string): number | null {
  if (!rows.length) return null
  return Math.max(...rows.map(r => daysSince(r[field])))
}

const AUTO_PENALIZABLE = new Set(['missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab'])

export default function TodayPage() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [vSettings, setVSettings] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<any[]>([])

  function loadLogs() {
    fetch('/api/logs').then(r => r.ok ? r.json() : []).then(d => {
      const todayStr = new Date().toISOString().slice(0, 10)
      const todays = (Array.isArray(d) ? d : []).filter((l: any) => String(l.created_at).slice(0, 10) === todayStr)
      setLogs(todays.slice(0, 12))
    }).catch(() => {})
  }

  function load() {
    fetch('/api/today/summary')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  function loadFlags() {
    fetch('/api/flags')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setFlags)
      .catch(() => {})
  }
  function loadAssignments() {
    fetch('/api/violations/assignments')
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments ?? {}); setVSettings(d.settings ?? {}) })
      .catch(() => {})
  }

  useEffect(() => { load(); loadFlags(); loadAssignments(); loadLogs() }, [])
  usePolling(load, 10000)
  usePolling(loadFlags, 30000)
  usePolling(loadLogs, 15000)

  const violations = useMemo(() => {
    if (!flags) return []
    const list: { type: string; label: string; count: number; days: number | null; href: string }[] = []
    if (flags.missingDays?.length) list.push({
      type: 'missing_days',
      label: 'Sales Receipt' + (flags.missingDays.length !== 1 ? 's' : '') + ' still not entered',
      count: flags.missingDays.length, days: oldestDays(flags.missingDays, 'missing_date'), href: '/sales?tab=Missing Days',
    })
    if (flags.noCash?.length) list.push({
      type: 'no_cash',
      label: 'walk-in receipt' + (flags.noCash.length !== 1 ? 's' : '') + ' missing cash counted',
      count: flags.noCash.length, days: oldestDays(flags.noCash, 'receipt_date'), href: '/sales?tab=No Cash',
    })
    if (flags.costGteSell?.length) list.push({
      type: 'cost_gte_sell',
      label: 'Cost Price' + (flags.costGteSell.length !== 1 ? 's' : '') + ' ≥ Selling Price still unresolved',
      count: flags.costGteSell.length, days: oldestDays(flags.costGteSell, 'receipt_date'), href: '/sales?tab=Cost Price',
    })
    if (flags.noStaffTimes?.length) list.push({
      type: 'no_staff_times',
      label: 'day' + (flags.noStaffTimes.length !== 1 ? 's' : '') + ' with no staff times recorded',
      count: flags.noStaffTimes.length, days: oldestDays(flags.noStaffTimes, 'missing_date'), href: '/staff?tab=No Times',
    })
    if (flags.uncheckedCab?.length) list.push({
      type: 'unchecked_cab',
      label: 'week' + (flags.uncheckedCab.length !== 1 ? 's' : '') + ' with no Cash at Bank confirmation',
      count: flags.uncheckedCab.length, days: oldestDays(flags.uncheckedCab, 'week_start'), href: '/cash-at-bank?tab=CAB Weekly',
    })
    if (flags.noGroup?.length) list.push({
      type: 'no_group',
      label: 'item' + (flags.noGroup.length !== 1 ? 's' : '') + ' with no group assigned',
      count: flags.noGroup.length, days: null, href: '/item?tab=No Group',
    })
    if (flags.duplicates?.length) list.push({
      type: 'duplicates',
      label: 'possible duplicate item pair' + (flags.duplicates.length !== 1 ? 's' : ''),
      count: flags.duplicates.length, days: null, href: '/item?tab=Duplicates',
    })
    if (flags.notInInventory?.length) list.push({
      type: 'not_in_inventory',
      label: 'item name' + (flags.notInInventory.length !== 1 ? 's' : '') + ' not found in inventory',
      count: flags.notInInventory.length, days: null, href: '/item?tab=Not in Inv.',
    })
    return list.sort((a, b) => b.count - a.count)
  }, [flags])

  const totalViolations = violations.reduce((s, v) => s + v.count, 0)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>
  if (!data) return <div className="py-10 text-center text-gray-400">Could not load today's summary.</div>

  const sales = data.sales ?? {}
  const bills = data.bills ?? {}
  const expenses = data.expenses ?? {}

  return (
    <div className="py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">Today</h1>
        <p className="text-[10px] text-gray-400">{fmtDate(data.date)}</p>
      </div>

      <Section title="Sales" href="/sales">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-600 min-w-0">
            {sales.count > 0
              ? <>{sales.count} receipt{sales.count !== 1 ? 's' : ''} · <span className="font-semibold text-blue-700">{fmt(sales.total)}</span> (WIC {fmt(sales.wic)} · GMC {fmt(sales.gmc)})</>
              : 'No sales recorded for today.'}
          </p>
          <Link href="/sales/new" className="shrink-0 text-[10px] font-semibold text-blue-600">+ New</Link>
        </div>
      </Section>

      <Section title="Bills" href="/bills">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-600 min-w-0">
            {bills.count > 0
              ? <>{bills.count} bill{bills.count !== 1 ? 's' : ''} · <span className="font-semibold text-orange-600">{fmt(bills.total)}</span></>
              : 'No bills recorded for today.'}
          </p>
          <Link href="/bills/new" className="shrink-0 text-[10px] font-semibold text-blue-600">+ New</Link>
        </div>
      </Section>

      <Section title="Expenses" href="/expenses">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-gray-600 min-w-0">
            {expenses.count > 0
              ? <>{expenses.count} entr{expenses.count !== 1 ? 'ies' : 'y'} · <span className="font-semibold text-red-500">{fmt(expenses.total)}</span></>
              : 'No expenses recorded for today.'}
          </p>
          <Link href="/expenses/new" className="shrink-0 text-[10px] font-semibold text-blue-600">+ New</Link>
        </div>
      </Section>

      <Section title="Stock Counting" href="/stock/counts?tab=Daily" linkLabel="Count Now →">
        <p className="text-[11px] text-gray-600">
          {data.pendingDailyCount > 0
            ? <><span className="font-semibold text-orange-600">{data.pendingDailyCount}</span> item{data.pendingDailyCount !== 1 ? 's' : ''} pending count today.</>
            : <span className="font-semibold text-green-600">All items counted today ✓</span>}
        </p>
      </Section>

      <Section title="Staff Today" href="/staff">
        <p className="text-[11px] text-gray-600 capitalize">
          {(!data.staffToday || data.staffToday.length === 0)
            ? <span className="normal-case text-gray-400">No one clocked in yet.</span>
            : `${data.staffToday.length} clocked in — ${data.staffToday.map((s: any) => s.staff_name).join(', ')}`}
        </p>
      </Section>

      <Section title="Cash at Bank" href="/cash-at-bank">
        <p className="text-[11px] text-gray-600">
          {data.latestCab
            ? <>Confirmed {fmtDate(String(data.latestCab.entry_date).slice(0,10))} · deficit{' '}
                <span className={`font-semibold ${Number(data.latestCab.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {data.latestCab.deficit != null ? fmt(data.latestCab.deficit) : '—'}
                </span>
              </>
            : <span className="text-gray-400">No confirmed entry yet.</span>}
        </p>
      </Section>

      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            Needs Attention {totalViolations > 0 && <span className="text-red-500">({totalViolations})</span>}
          </p>
          <Link href="/staff?tab=Assignments" className="text-[10px] text-blue-600 font-semibold">
            Assign →
          </Link>
        </div>
        {!flags ? (
          <p className="text-[11px] text-gray-400 py-[1px]">Loading…</p>
        ) : violations.length === 0 ? (
          <p className="text-[11px] text-green-600 font-medium py-[1px]">All clear ✓</p>
        ) : (
          <div>
            {violations.map(v => {
              const assignedTo = assignments[v.type]
              const canAutoPenalize = AUTO_PENALIZABLE.has(v.type)
              const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
              const atRisk = canAutoPenalize && assignedTo && v.days != null && v.days >= threshold
              return (
                <Link key={v.href} href={v.href}
                  className="flex items-center justify-between py-[2px] text-[11px] leading-tight hover:bg-gray-50 -mx-1 px-1 rounded transition gap-2">
                  <span className="min-w-0 truncate">
                    <span className="font-bold text-red-500">{v.count}</span>{' '}
                    <span className="text-gray-700">{v.label}</span>
                    {v.days != null && <span className="text-gray-400"> — {agePhrase(v.days)}</span>}
                    {assignedTo && (
                      <span className={`ml-1 ${atRisk ? 'text-red-500 font-semibold' : 'text-gray-300'}`}>
                        · <span className="capitalize">{assignedTo}</span>{atRisk && ' ⚠'}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold shrink-0">Fix →</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <AnnouncementsPanel />

      <div className="pt-2 border-t border-gray-200">
        <DayBookFeed />
      </div>
    </div>
  )
}
