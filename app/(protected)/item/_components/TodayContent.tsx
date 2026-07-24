'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
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
    if (diffDays < 2) return `${diffDays}d ago`
    // Older than 2 days: show the day and date it was posted instead of a
    // relative count, e.g. "Mon, 7 Jul" (year added if it wasn't this year).
    return d.toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
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

function categoryLabel(c: string) {
  return c.replace(/\b\w/g, ch => ch.toUpperCase())
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

// One feed row -- shared between the normal live feed and search results so
// they render identically.
function PostRow({ p, showDateHeader, canDelete, onLongPressStart, onLongPressEnd, onDelete }: {
  p: Announcement
  showDateHeader: boolean
  canDelete: boolean
  onLongPressStart: (p: Announcement) => void
  onLongPressEnd: () => void
  onDelete: (id: number) => void
}) {
  return (
    <div>
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
          onPointerDown={() => onLongPressStart(p)}
          onPointerUp={onLongPressEnd}
          onPointerLeave={onLongPressEnd}
          onContextMenu={e => e.preventDefault()}
          className="flex items-center justify-between gap-2 px-3 py-1 select-none"
        >
          <p className="min-w-0 truncate text-[11px]">
            <span className="font-semibold text-gray-700 capitalize">{p.author}</span>
            <span className="text-gray-400"> · {fmtAnnTime(p.created_at)} · </span>
            <span className="text-gray-800">{p.body}</span>
          </p>
          {canDelete && (
            <button onClick={() => onDelete(p.id)} className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
          )}
        </div>
      ) : (
        <div
          onPointerDown={() => onLongPressStart(p)}
          onPointerUp={onLongPressEnd}
          onPointerLeave={onLongPressEnd}
          onContextMenu={e => e.preventDefault()}
          className="px-3 py-1.5 space-y-0.5 select-none"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-700 capitalize">{p.author}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-gray-400">{fmtAnnTime(p.created_at)}</span>
              {canDelete && (
                <button onClick={() => onDelete(p.id)} className="text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
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
}

function AnnouncementsPanel() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const canCompose = !!session
  const canDelete = ['owner', 'manager'].includes(role)

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
  const typeFilterRef = useRef<HTMLDivElement>(null)
  const [typeFilterOpen, setTypeFilterOpen] = useState(false)
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
      // leave hasMore as-is -- the scroll-into-view sentinel just retries next time
    } finally {
      setLoadingMore(false)
    }
  }

  // ─── Search ──────────────────────────────────────────────────────────────
  // Free text + type + date range, all combinable, searching the full
  // history server-side (not just whatever's currently loaded).
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [searchResults, setSearchResults] = useState<Announcement[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchLoadingMore, setSearchLoadingMore] = useState(false)
  const [searchHasMore, setSearchHasMore] = useState(true)

  const hasActiveSearch = !!(searchText.trim() || searchCategory || searchFrom || searchTo)

  // Loaded once on mount rather than lazily on searchOpen -- the type
  // filter now lives outside the search panel (next to the mic button), so
  // it needs the category list available right away too.
  useEffect(() => {
    fetch('/api/announcements/categories')
      .then(r => r.ok ? r.json() : [])
      .then(d => setCategories(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (typeFilterRef.current && !typeFilterRef.current.contains(e.target as Node)) setTypeFilterOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function searchQuery(before?: string) {
    const params = new URLSearchParams()
    if (searchText.trim()) params.set('q', searchText.trim())
    if (searchCategory) params.set('category', searchCategory)
    if (searchFrom) params.set('from', searchFrom)
    if (searchTo) params.set('to', searchTo)
    if (before) params.set('before', before)
    return params.toString()
  }

  useEffect(() => {
    if (!hasActiveSearch) { setSearchResults([]); setSearchHasMore(true); return }
    setSearchLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/announcements?${searchQuery()}`)
        .then(r => r.ok ? r.json() : [])
        .then((d: Announcement[]) => {
          setSearchResults(Array.isArray(d) ? d : [])
          setSearchHasMore(Array.isArray(d) && d.length >= PAGE_SIZE)
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false))
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText, searchCategory, searchFrom, searchTo])

  async function loadMoreSearch() {
    if (searchLoadingMore || !searchHasMore || searchResults.length === 0) return
    setSearchLoadingMore(true)
    try {
      const oldest = searchResults[searchResults.length - 1]
      const res = await fetch(`/api/announcements?${searchQuery(oldest.created_at)}`)
      const d: Announcement[] = await res.json()
      if (Array.isArray(d) && d.length > 0) {
        setSearchResults(prev => [...prev, ...d])
        if (d.length < PAGE_SIZE) setSearchHasMore(false)
      } else {
        setSearchHasMore(false)
      }
    } catch {
      // the sentinel just retries next time it's back in view
    } finally {
      setSearchLoadingMore(false)
    }
  }

  function clearSearch() {
    setSearchText(''); setSearchCategory(''); setSearchFrom(''); setSearchTo('')
  }

  // Auto-loads older announcements (either feed) as the bottom sentinel
  // scrolls into view -- replaces the old "Load older" tap-to-load button.
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      if (hasActiveSearch) loadMoreSearch()
      else loadMore()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveSearch, posts.length, searchResults.length, hasMore, searchHasMore])

  useEffect(() => { load() }, [])
  usePolling(load, 15000, !hasActiveSearch)

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
    if (!confirm('Delete this post?')) return
    await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  const canPost = !posting && !recording && (body.trim().length > 0 || media.length > 0) && !media.some(m => m.uploading)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Search — text + type + date range, all combinable, searching the
          full history (not just what's loaded). Tucked behind an icon so it
          doesn't take up space until someone actually wants it. */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Announcements</p>
        <button onClick={() => setSearchOpen(o => !o)}
          className={`text-base leading-none transition ${searchOpen || hasActiveSearch ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}>
          🔍
        </button>
      </div>
      {searchOpen && (
        <div className="px-2 py-2 border-b border-gray-100 space-y-1.5 bg-gray-50/60">
          <input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search text or name…"
            className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex items-center gap-1.5">
            <input type="date" value={searchFrom} onChange={e => setSearchFrom(e.target.value)}
              className="flex-1 min-w-0 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none" />
            <span className="text-[10px] text-gray-400 shrink-0">to</span>
            <input type="date" value={searchTo} onChange={e => setSearchTo(e.target.value)}
              className="flex-1 min-w-0 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none" />
          </div>
          {hasActiveSearch && (
            <button onClick={clearSearch} className="text-[10px] font-semibold text-blue-600">Clear filters</button>
          )}
        </div>
      )}

      {/* Compose — any logged-in staff member, matches server-side posting
          permission. Kept compact/embedded (WhatsApp-style single bar) so it
          doesn't dominate the Today page. */}
      {canCompose && (
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
              {/* Type filter -- inside the message box alongside 📎/📷,
                  outside the collapsible search panel, so filtering the feed
                  by type never needs opening search first. */}
              <div className="relative shrink-0" ref={typeFilterRef}>
                {typeFilterOpen && (
                  <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[160px] max-h-56 overflow-y-auto z-20">
                    <button onClick={() => { setSearchCategory(''); setTypeFilterOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition ${!searchCategory ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                      All types
                    </button>
                    {categories.map(c => (
                      <button key={c} onClick={() => { setSearchCategory(c); setTypeFilterOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition border-t border-gray-100 ${searchCategory === c ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                        {categoryLabel(c)}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setTypeFilterOpen(o => !o)} disabled={recording} title="Filter by type"
                  className={`shrink-0 text-base leading-none w-6 h-6 flex items-center justify-center transition disabled:opacity-40
                    ${searchCategory ? 'text-blue-600' : 'text-gray-400 hover:text-blue-600'}`}>
                  🗂️
                </button>
              </div>
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

      {/* Feed — search results (full history) when a search/filter is
          active, otherwise the normal live feed. Older items load
          automatically as the sentinel at the bottom scrolls into view. */}
      {hasActiveSearch ? (
        searchLoading && searchResults.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">Searching…</p>
        ) : searchResults.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center py-3">No announcements match.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {searchResults.map((p, i) => (
              <PostRow key={p.id} p={p}
                showDateHeader={i === 0 || dayKey(p.created_at) !== dayKey(searchResults[i - 1].created_at)}
                canDelete={canDelete} onLongPressStart={startLongPress} onLongPressEnd={cancelLongPress} onDelete={removePost} />
            ))}
            {searchHasMore && <div ref={sentinelRef} className="h-1" />}
            {searchLoadingMore && <p className="text-[10px] text-gray-400 text-center py-2">Loading…</p>}
          </div>
        )
      ) : posts.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-3">No announcements yet.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {posts.map((p, i) => (
            <PostRow key={p.id} p={p}
              showDateHeader={i === 0 || dayKey(p.created_at) !== dayKey(posts[i - 1].created_at)}
              canDelete={canDelete} onLongPressStart={startLongPress} onLongPressEnd={cancelLongPress} onDelete={removePost} />
          ))}
          {hasMore && <div ref={sentinelRef} className="h-1" />}
          {loadingMore && <p className="text-[10px] text-gray-400 text-center py-2">Loading…</p>}
        </div>
      )}
    </div>
  )
}

// Flags moved to the bottom RoleBar (Joe/Bino/Opener/Closer tabs) so this
// page stays announcement-focused and the feed never gets pushed down.
export default function TodayPage() {
  return (
    <div className="py-2">
      <AnnouncementsPanel />
    </div>
  )
}
