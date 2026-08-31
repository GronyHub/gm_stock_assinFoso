'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/lib/usePolling'
import { Linkify } from '@/lib/linkify'
import { formatDuration } from '@/lib/fmtDuration'
import { formatGapMins } from '@/lib/fmtGap'
import { effectiveDurationSeconds } from '@/lib/workedDuration'

// ─── Announcements ────────────────────────────────────────────────────────────
// Read-only feed -- composing (message/media/voice/reply/search) was
// removed from this panel entirely; it's just the activity log now.
type MediaItem = { url: string; type: string }
type Announcement = {
  id: number; author: string; body: string; media_urls: MediaItem[]; created_at: string
  reply_to_id?: number | null
  reply_to_author?: string | null
  reply_to_body?: string | null
  // Estimated time the activity itself took -- only set for activity types
  // that can actually compute one (currently just live sale taps, see
  // /api/sales/live-tap). Null everywhere else until that type gets its own
  // rule (see lib/logger.ts's own comment on this column).
  estimated_duration_seconds?: number | null
  // The raw logActivity action string (e.g. "counted stock") -- feeds
  // effectiveDurationSeconds' flat-minute fallback for the Total column,
  // same as /api/staff-times/worked-today's own worked-time sum.
  category?: string | null
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

// Per-day, per-staff total of effectiveDurationSeconds -- backs the Total
// column below. Grouped by calendar day (not just "today") so this stays
// correct as older days load in via "load more", same effectiveDurationSeconds
// rule /api/staff-times/worked-today applies server-side for the
// present-staff banner, so the two always agree.
function computeDailyTotals(list: Announcement[]): Record<string, Record<string, number>> {
  const totals: Record<string, Record<string, number>> = {}
  for (const p of list) {
    const day = dayKey(p.created_at)
    const seconds = effectiveDurationSeconds(p.category, p.estimated_duration_seconds)
    if (!totals[day]) totals[day] = {}
    totals[day][p.author] = (totals[day][p.author] ?? 0) + seconds
  }
  return totals
}

// `list` is newest-first (same convention as Live Sale's Log mode dateTaps),
// so the previous chronological entry relative to index i is at i+1. No
// gap for the day's oldest loaded entry -- unlike the Log mode's Gap column,
// this has no "since shop opening" fallback to reach for, since most
// activity types have nothing resembling shop hours.
function gapMinsFor(list: Announcement[], i: number): number | null {
  const prev = list[i + 1]
  if (!prev || dayKey(prev.created_at) !== dayKey(list[i].created_at)) return null
  return (new Date(list[i].created_at).getTime() - new Date(prev.created_at).getTime()) / 60000
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

// Gap (time since the previous activity) and Dur (that activity's own
// estimated duration, when known) -- same two figures Live Sale's Log mode
// used to show per sale line, generalized to every activity type here.
function ActivityMeta({ gapMins, durationSeconds }: { gapMins: number | null; durationSeconds?: number | null }) {
  if (gapMins == null && !durationSeconds) return null
  return (
    <>
      {gapMins != null && <span className="text-gray-400"> · Gap {formatGapMins(gapMins)}</span>}
      {!!durationSeconds && <span className="text-gray-400"> · Dur {formatDuration(durationSeconds)}</span>}
    </>
  )
}

// Number of columns the shared <table> header declares -- Staff/Time/Gap/
// Dur/Total/Activity -- kept as one constant so the colSpan on date-header
// and rich-post rows can't silently drift out of sync with the header.
const FEED_COLUMNS = 6

// One feed row (or two, when a date header precedes it). Returns <tr>s
// directly (no wrapping element) so every row -- auto-logged or a rich
// historical post with media/a reply -- lives in the same <table>, sharing
// one header and one scroll region instead of each row scrolling
// independently.
function PostRow({ p, showDateHeader, gapMins, staffDayTotalSeconds, canDelete, onDelete }: {
  p: Announcement
  showDateHeader: boolean
  gapMins: number | null
  staffDayTotalSeconds: number
  canDelete: boolean
  onDelete: (id: number) => void
}) {
  const isAutoLogged = (p.media_urls ?? []).length === 0 && !p.reply_to_id && p.body && !p.body.includes('\n') && p.body.length <= 60
  const durationSeconds = effectiveDurationSeconds(p.category, p.estimated_duration_seconds)
  return (
    <>
      {showDateHeader && (
        <tr>
          <td colSpan={FEED_COLUMNS} className="text-center py-1 bg-gray-50/60">
            <span className="text-[9px] font-semibold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
              {dayLabel(p.created_at)}
            </span>
          </td>
        </tr>
      )}
      {isAutoLogged ? (
        // Auto-logged activity row -- Staff/Time/Gap/Dur/Total/Activity
        // each get their own aligned column (same idea as Live Sale's Log
        // mode table). Activity stays single-line (whitespace-nowrap, not
        // wrapped or truncated) -- the shared table wrapper scrolls
        // horizontally when it's long, same trade-off Live Sale's Log mode
        // makes for its Item column.
        <tr className="hover:bg-gray-50">
          <td className="pl-3 pr-2 py-1 font-semibold text-gray-700 capitalize whitespace-nowrap text-[11px]">{p.author}</td>
          <td className="px-2 py-1 text-gray-400 text-[10px] whitespace-nowrap">{fmtAnnTime(p.created_at)}</td>
          <td className="px-2 py-1 text-gray-400 text-[10px] whitespace-nowrap">{gapMins != null ? formatGapMins(gapMins) : '—'}</td>
          <td className="px-2 py-1 text-gray-400 text-[10px] whitespace-nowrap">{durationSeconds > 0 ? formatDuration(durationSeconds) : '—'}</td>
          <td className="px-2 py-1 text-gray-500 font-semibold text-[10px] whitespace-nowrap">{formatDuration(staffDayTotalSeconds)}</td>
          <td className="px-2 pr-3 py-1 text-gray-800 text-[11px] whitespace-nowrap">{p.body}</td>
        </tr>
      ) : (
        <tr>
          <td colSpan={FEED_COLUMNS} className="p-0">
            <div className="px-3 py-1.5 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-700 capitalize">{p.author}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {fmtAnnTime(p.created_at)}
                    <ActivityMeta gapMins={gapMins} durationSeconds={p.estimated_duration_seconds} />
                  </span>
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
              {p.body && <Linkify text={p.body} as="p" className="text-xs text-gray-800 whitespace-pre-wrap leading-snug" />}
              <MediaGrid items={p.media_urls ?? []} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function AnnouncementsPanel() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role
  const canDelete = ['owner', 'manager'].includes(role)

  const [posts, setPosts] = useState<Announcement[]>([])
  const dailyTotals = useMemo(() => computeDailyTotals(posts), [posts])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

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

  // Auto-loads older announcements as the bottom sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, hasMore])

  useEffect(() => { load() }, [])
  usePolling(load, 15000)

  // Clears the Home badge -- opening this panel means the user has seen
  // whatever's currently posted, even before scrolling through it.
  useEffect(() => {
    fetch('/api/announcements/mark-read', { method: 'POST' }).catch(() => {})
  }, [])

  async function removePost(id: number) {
    if (!confirm('Delete this post?')) return
    await fetch('/api/announcements', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    load()
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {posts.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-3">No announcements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="text-left pl-3 pr-2 py-1 whitespace-nowrap">Staff</th>
                <th className="text-left px-2 py-1 whitespace-nowrap">Time</th>
                <th className="text-left px-2 py-1 whitespace-nowrap">Gap</th>
                <th className="text-left px-2 py-1 whitespace-nowrap">Dur</th>
                <th className="text-left px-2 py-1 whitespace-nowrap">Total</th>
                <th className="text-left px-2 pr-3 py-1">Activity</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => (
                <PostRow key={p.id} p={p}
                  showDateHeader={i === 0 || dayKey(p.created_at) !== dayKey(posts[i - 1].created_at)}
                  gapMins={gapMinsFor(posts, i)}
                  staffDayTotalSeconds={dailyTotals[dayKey(p.created_at)]?.[p.author] ?? 0}
                  canDelete={canDelete} onDelete={removePost} />
              ))}
              {hasMore && <tr><td colSpan={FEED_COLUMNS}><div ref={sentinelRef} className="h-1" /></td></tr>}
              {loadingMore && <tr><td colSpan={FEED_COLUMNS} className="text-[10px] text-gray-400 text-center py-2">Loading…</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Flags moved to Grony Cash's and Grony Manage's own Tasks left-pane items
// so this page stays announcement-focused and the feed never gets pushed
// down.
export default function TodayPage() {
  return (
    <div className="py-2">
      <AnnouncementsPanel />
    </div>
  )
}
