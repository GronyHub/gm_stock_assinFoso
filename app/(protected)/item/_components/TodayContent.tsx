'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { fmtDate, fmtOrdinalDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'

// ─── Announcements ────────────────────────────────────────────────────────────
type MediaItem = { url: string; type: string }
type Announcement = {
  id: number; author: string; body: string; media_urls: MediaItem[]; created_at: string
  reply_to_id?: number | null
  reply_to_author?: string | null
  reply_to_body?: string | null
}
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

function dayKey(iso: string) {
  return new Date(iso).toDateString()
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
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
    <div className="mt-1 space-y-0.5">
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
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: number; author: string; body: string } | null>(null)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<MediaFile[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function startLongPress(p: Announcement) {
    longPressTimerRef.current = setTimeout(() => {
      setReplyTo({ id: p.id, author: p.author, body: p.body })
      if (navigator.vibrate) navigator.vibrate(15)
    }, 500)
  }
  function cancelLongPress() {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null }
  }

  const PAGE_SIZE = 30

  // Merges rather than replaces, so posts loaded further back via "Load older"
  // don't get wiped out by the next 15s poll (which only ever asks for the
  // latest page) -- that was why older announcements used to disappear.
  function load() {
    fetch('/api/announcements')
      .then(r => r.json())
      .then((d: Announcement[]) => {
        if (!Array.isArray(d)) return
        setPosts(prev => {
          if (prev.length === 0) {
            if (d.length < PAGE_SIZE) setHasMore(false)
            return d
          }
          const existingIds = new Set(prev.map(p => p.id))
          const fresh = d.filter(p => !existingIds.has(p.id))
          if (fresh.length === 0) return prev
          return [...fresh, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        })
      })
      .catch(() => {})
  }

  async function loadMore() {
    if (loadingMore || !hasMore || posts.length === 0) return
    setLoadingMore(true)
    try {
      const oldest = posts[posts.length - 1]
      const res = await fetch(`/api/announcements?before=${encodeURIComponent(oldest.created_at)}`)
      const d: Announcement[] = await res.json()
      if (Array.isArray(d) && d.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id))
          const older = d.filter(p => !existingIds.has(p.id))
          return [...prev, ...older]
        })
        if (d.length < PAGE_SIZE) setHasMore(false)
      } else {
        setHasMore(false)
      }
    } catch {
      // leave hasMore as-is -- user can just tap the button again
    } finally {
      setLoadingMore(false)
    }
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
        body: JSON.stringify({ body: body.trim(), media_urls, reply_to_id: replyTo?.id ?? null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed') }
      setBody('')
      setMedia([])
      setReplyTo(null)
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
      {/* Compose — owner/manager only, matches server-side posting permission.
          Kept compact/embedded (WhatsApp-style single bar) so it doesn't
          dominate the Today page. */}
      {canManage && (
        <div className="px-2 py-2 border-b border-gray-100 space-y-1.5">
          {replyTo && (
            <div className="flex items-center justify-between gap-2 bg-blue-50 rounded-lg px-2 py-1">
              <p className="min-w-0 truncate text-[10px] text-blue-700">
                Replying to <span className="font-semibold capitalize">{replyTo.author}</span>
                {replyTo.body && <span className="text-blue-500"> · {replyTo.body.slice(0, 40)}{replyTo.body.length > 40 ? '…' : ''}</span>}
              </p>
              <button onClick={() => setReplyTo(null)} className="shrink-0 text-blue-400 hover:text-blue-600 font-bold leading-none">×</button>
            </div>
          )}

          {/* Media previews */}
          {media.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1">
              {media.map(m => (
                <div key={m.localUrl} className="relative w-12 h-12 rounded-md overflow-hidden border border-gray-200 bg-gray-100">
                  {m.kind === 'video' ? (
                    <video src={m.localUrl} className="w-full h-full object-cover" />
                  ) : m.kind === 'audio' ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-white text-base">🎤</div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.localUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  {m.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[8px] font-semibold">…</span>
                    </div>
                  )}
                  {m.error && (
                    <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                      <span className="text-white text-[8px] font-semibold text-center px-0.5">!</span>
                    </div>
                  )}
                  <button
                    onClick={() => removeMedia(m.localUrl)}
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center leading-none"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-[10px] text-red-500 px-1">{error}</p>}
          {recording && <p className="text-[10px] text-red-500 font-semibold px-1">● Recording {fmtRecTime(recordSeconds)}…</p>}

          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center gap-1.5 bg-gray-100 rounded-full pl-3 pr-1.5 py-1 min-w-0">
              <input
                value={body}
                onChange={e => setBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost() }}
                placeholder="Message"
                disabled={recording}
                className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none disabled:opacity-50"
              />
              <button onClick={() => fileInputRef.current?.click()} disabled={recording}
                className="shrink-0 text-gray-400 hover:text-blue-600 disabled:opacity-40 text-base leading-none w-6 h-6 flex items-center justify-center">
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              <button onClick={() => cameraInputRef.current?.click()} disabled={recording}
                className="shrink-0 text-gray-400 hover:text-blue-600 disabled:opacity-40 text-base leading-none w-6 h-6 flex items-center justify-center">
                📷
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {canPost ? (
              <button
                onClick={handlePost}
                disabled={posting}
                className="shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center text-sm transition"
              >
                {posting ? '…' : '➤'}
              </button>
            ) : recording ? (
              <button
                onClick={stopRecording}
                className="shrink-0 w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold animate-pulse"
              >
                ⏹
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="shrink-0 w-9 h-9 rounded-full bg-green-500 hover:bg-green-400 text-white flex items-center justify-center text-sm transition"
              >
                🎤
              </button>
            )}
          </div>
        </div>
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-3">No announcements yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {posts.map((p, i) => {
            const showDateHeader = i === 0 || dayKey(p.created_at) !== dayKey(posts[i - 1].created_at)
            return (
              <div key={p.id}>
                {showDateHeader && (
                  <div className="flex justify-center py-1 bg-gray-50/60">
                    <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                      {dayLabel(p.created_at)}
                    </span>
                  </div>
                )}
                {(p.media_urls ?? []).length === 0 && !p.reply_to_id && p.body && !p.body.includes('\n') && p.body.length <= 60 ? (
                  // Compact single-line row -- for short posts (mostly auto-logged
                  // activity like "clocked out — 7:13pm") that don't need their
                  // own separate line for the message. Long-press to reply.
                  <div
                    onPointerDown={() => startLongPress(p)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={e => e.preventDefault()}
                    className="flex items-center justify-between gap-2 px-3 py-1 select-none"
                  >
                    <p className="min-w-0 truncate text-[11px]">
                      <span className="font-semibold text-gray-700 capitalize">{p.author}</span>
                      <span className="text-gray-400"> · {fmtAnnTime(p.created_at)} · </span>
                      <span className="text-gray-800">{p.body}</span>
                    </p>
                    {canManage && (
                      <button onClick={() => removePost(p.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                    )}
                  </div>
                ) : (
                  <div
                    onPointerDown={() => startLongPress(p)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onContextMenu={e => e.preventDefault()}
                    className="px-3 py-1.5 space-y-0.5 select-none"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-gray-700 capitalize">{p.author}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-gray-400">{fmtAnnTime(p.created_at)}</span>
                        {canManage && (
                          <button onClick={() => removePost(p.id)} className="text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                        )}
                      </div>
                    </div>
                    {p.reply_to_id && (
                      <div className="text-[10px] text-gray-500 bg-gray-50 border-l-2 border-gray-300 rounded px-1.5 py-0.5">
                        <span className="font-semibold capitalize">{p.reply_to_author ?? 'Unknown'}</span>
                        {p.reply_to_body && <>: {p.reply_to_body.slice(0, 60)}{p.reply_to_body.length > 60 ? '…' : ''}</>}
                      </div>
                    )}
                    {p.body && <p className="text-xs text-gray-800 whitespace-pre-wrap leading-snug">{p.body}</p>}
                    <MediaGrid items={p.media_urls ?? []} />
                  </div>
                )}
              </div>
            )
          })}
          {hasMore && (
            <div className="flex justify-center py-2">
              <button onClick={loadMore} disabled={loadingMore}
                className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-50">
                {loadingMore ? 'Loading…' : 'Load older announcements'}
              </button>
            </div>
          )}
        </div>
      )}
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

const AUTO_PENALIZABLE = new Set(['missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab', 'dup_receipts'])

const SHORT_LABEL: Record<string, string> = {
  missing_days: 'Sales Receipts',
  no_cash: 'Cash Counts',
  cost_gte_sell: 'Cost Prices',
  no_staff_times: 'Staff Times',
  unchecked_cab: 'Cash at Bank',
  no_group: 'Item Groups',
  duplicates: 'Duplicate Items',
  not_in_inventory: 'Inventory Names',
  dup_receipts: 'Duplicate Receipts',
}

export default function TodayPage() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [assignedBy, setAssignedBy] = useState<Record<string, string>>({})
  const [assignedOn, setAssignedOn] = useState<Record<string, string>>({})
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
      .then(d => {
        setAssignments(d.assignments ?? {}); setDeadlines(d.deadlines ?? {})
        setAssignedBy(d.assignedBy ?? {}); setAssignedOn(d.assignedOn ?? {})
        setVSettings(d.settings ?? {})
      })
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
    if (flags.dupReceipts?.length) list.push({
      type: 'dup_receipts',
      label: 'day' + (flags.dupReceipts.length !== 1 ? 's' : '') + ' with duplicate WIC/GMC receipts',
      count: flags.dupReceipts.length, days: oldestDays(flags.dupReceipts, 'receipt_date'), href: '/sales?tab=Dup Receipts',
    })
    return list.sort((a, b) => b.count - a.count)
  }, [flags])

  const totalViolations = violations.reduce((s, v) => s + v.count, 0)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>
  if (!data) return <div className="py-10 text-center text-gray-400">Could not load today's summary.</div>

  return (
    <div className="py-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">Today</h1>
        <p className="text-[10px] text-gray-400">{fmtDate(data.date)}</p>
      </div>

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
              const deadline = deadlines[v.type]
              const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
              const overdue = deadline ? daysSince(deadline) >= 1 : v.days != null && v.days >= threshold
              const atRisk = canAutoPenalize && assignedTo && overdue

              if (!assignedTo) {
                return (
                  <Link key={v.href} href={v.href}
                    className="flex items-center justify-between py-[2px] text-[11px] leading-tight hover:bg-gray-50 -mx-1 px-1 rounded transition gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-bold text-red-500">{v.count}</span>{' '}
                      <span className="text-gray-700">{v.label}</span>
                      {v.days != null && <span className="text-gray-400"> — {agePhrase(v.days)}</span>}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold shrink-0">Fix →</span>
                  </Link>
                )
              }

              const remaining = deadline ? -daysSince(deadline) : (canAutoPenalize && v.days != null ? threshold - v.days : null)
              const remainingPhrase = remaining == null
                ? 'please complete'
                : remaining > 0
                  ? `you have ${remaining} day${remaining !== 1 ? 's' : ''} more to complete`
                  : remaining === 0
                    ? 'due today to complete'
                    : `overdue by ${Math.abs(remaining)} day${Math.abs(remaining) !== 1 ? 's' : ''} to complete`
              const on = assignedOn[v.type]
              const by = assignedBy[v.type]

              return (
                <div key={v.href} className={`py-[3px] text-[11px] leading-snug ${atRisk ? 'text-red-500' : 'text-gray-700'}`}>
                  <span className="capitalize font-semibold">{assignedTo}</span>, {remainingPhrase}{' '}
                  <span className="font-bold text-red-500">{v.count}</span>{' '}
                  {SHORT_LABEL[v.type] ?? v.label}{' '}
                  <Link href={v.href} className="text-blue-600 font-semibold">View</Link>
                  {atRisk && ' ⚠'}
                  {on && (
                    <span className="text-gray-400">
                      {' '}(TAO {fmtOrdinalDate(on)}{by && <> by <span className="capitalize">{by}</span></>})
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AnnouncementsPanel />
    </div>
  )
}
