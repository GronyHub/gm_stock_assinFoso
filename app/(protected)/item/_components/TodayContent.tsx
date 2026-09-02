'use client'
import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/lib/usePolling'
import { Linkify } from '@/lib/linkify'
import { formatDuration } from '@/lib/fmtDuration'
import { formatGapMins } from '@/lib/fmtGap'
import { effectiveDurationSeconds } from '@/lib/workedDuration'
import { fmtClockTime } from '@/lib/clockTime'

function fmt(val: string | number | null | undefined): string {
  if (val == null) return '—'
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

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
  // that can actually compute one (currently live sale taps and a flat
  // amount for bills/expenses -- see lib/logger.ts's own comment on this
  // column and /api/sales/live-tap for the goods/services rule).
  estimated_duration_seconds?: number | null
  // The raw logActivity action string (e.g. "counted stock") -- feeds
  // effectiveDurationSeconds' flat-minute fallback for the Total column,
  // same as /api/staff-times/worked-today's own worked-time sum.
  category?: string | null
  // Item/Qty/SP/SOH -- the same columns Live Sale's Log mode shows, joined
  // back from live_sale_taps via source_id (see /api/announcements' own
  // comment). Null for every activity type besides a live sale tap.
  tap_item_name?: string | null
  tap_quantity?: string | number | null
  tap_price?: string | number | null
  tap_soh?: string | number | null
  tap_cost_price?: string | number | null
}

// GMT calendar date (YYYY-MM-DD) -- both the day-header grouping below and
// /api/announcements/daily-totals' own ?date= param key off this, so a
// post never gets grouped into a different day than the one its Total
// column total was actually computed for.
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

// `list` is newest-first, so the previous chronological entry relative to
// index i is at i+1. No gap for the day's oldest loaded entry -- unlike
// Live Sale's Log mode Gap column, this has no "since shop opening"
// fallback to reach for, since most activity types have nothing resembling
// shop hours.
function gapMinsFor(list: Announcement[], i: number): number | null {
  const prev = list[i + 1]
  if (!prev || dayKey(prev.created_at) !== dayKey(list[i].created_at)) return null
  return (new Date(list[i].created_at).getTime() - new Date(prev.created_at).getTime()) / 60000
}

function dayLabel(iso: string): string {
  const day = dayKey(iso)
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10)
  if (day === today) return 'Today'
  if (day === yesterday) return 'Yesterday'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
    year: d.getUTCFullYear() !== now.getUTCFullYear() ? 'numeric' : undefined,
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

// Number of columns the shared <table> header declares -- Time/Activity/
// Item/Qty/SP/CP/PF/SOH/Gap/Staff/Duration/Total -- kept as one constant
// so the colSpan on date-header and rich-post rows can't silently drift
// out of sync with the header.
const FEED_COLUMNS = 12

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
  const isSale = p.tap_item_name != null
  const sp = isSale ? Number(p.tap_price) || 0 : 0
  const cp = isSale ? Number(p.tap_cost_price) || 0 : 0
  const pf = isSale ? (sp - cp) * (Number(p.tap_quantity) || 0) : 0
  return (
    <>
      {showDateHeader && (
        <tr>
          <td colSpan={FEED_COLUMNS} className="text-center py-1 bg-gray-50/60">
            <span className="text-[7px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">
              {dayLabel(p.created_at)}
            </span>
          </td>
        </tr>
      )}
      {isAutoLogged ? (
        // Auto-logged activity row -- Time/Activity/Qty/Gap/Staff/Duration/
        // Total/Item/SP/CP/PF/SOH each get their own aligned column (same
        // idea, and largely the same columns, as Live Sale's Log mode
        // table -- Item/Qty/SP/CP/PF/SOH only ever populate for a live sale
        // tap, '—' for every other activity type). Activity stays
        // single-line (whitespace-nowrap, not wrapped or truncated) -- the
        // shared table wrapper scrolls horizontally when it's long, same
        // trade-off Log mode makes for its own Item column.
        <tr className="hover:bg-gray-50">
          <td className="pl-2 pr-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap">{fmtClockTime(p.created_at)}</td>
          <td className="px-1 py-0.5 text-gray-800 text-[8px] whitespace-nowrap">{p.body}</td>
          <td className="px-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap text-right">{isSale ? fmt(p.tap_quantity) : '—'}</td>
          <td className="px-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap text-right">{gapMins != null ? formatGapMins(gapMins) : '—'}</td>
          <td className="px-1 py-0.5 font-semibold text-gray-700 capitalize whitespace-nowrap text-[8px]">{p.author}</td>
          <td className="px-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap">{durationSeconds > 0 ? formatDuration(durationSeconds) : '—'}</td>
          <td className="px-1 py-0.5 text-gray-500 font-semibold text-[7px] whitespace-nowrap">{formatDuration(staffDayTotalSeconds)}</td>
          <td className="px-1 py-0.5 text-gray-700 text-[8px] whitespace-nowrap">{p.tap_item_name ?? '—'}</td>
          <td className="px-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap text-right">{isSale ? fmt(sp) : '—'}</td>
          <td className="px-1 py-0.5 text-gray-400 text-[7px] whitespace-nowrap text-right">{isSale ? fmt(cp) : '—'}</td>
          <td className={`px-1 py-0.5 text-[7px] whitespace-nowrap text-right ${isSale && pf < 0 ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{isSale ? fmt(pf) : '—'}</td>
          <td className="px-1 pr-2 py-0.5 text-gray-400 text-[7px] whitespace-nowrap text-right">{isSale ? fmt(p.tap_soh) : '—'}</td>
        </tr>
      ) : (
        <tr>
          <td colSpan={FEED_COLUMNS} className="p-0">
            <div className="px-2 py-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-semibold text-gray-700 capitalize">{p.author}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[8px] text-gray-400">
                    {fmtClockTime(p.created_at)}
                    {!!durationSeconds && <span className="text-gray-400"> · Dur {formatDuration(durationSeconds)}</span>}
                  </span>
                  {canDelete && (
                    <button onClick={() => onDelete(p.id)} className="text-gray-300 hover:text-red-500 font-bold leading-none">×</button>
                  )}
                </div>
              </div>
              {p.reply_to_id && (
                <div className="text-[8px] text-gray-500 bg-gray-50 border-l-2 border-gray-300 rounded px-1.5 py-0.5">
                  <span className="font-semibold capitalize">{p.reply_to_author ?? 'Unknown'}</span>
                  {p.reply_to_body && <>: {p.reply_to_body.slice(0, 60)}{p.reply_to_body.length > 60 ? '…' : ''}</>}
                </div>
              )}
              {p.body && <Linkify text={p.body} as="p" className="text-[9px] text-gray-800 whitespace-pre-wrap leading-snug" />}
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
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const PAGE_SIZE = 30

  // Each staff member's running cumulative total for the day, keyed by
  // announcement id -- straight from /api/announcements/daily-totals rather
  // than summed from `posts` itself, which is only ever a paginated window
  // (the latest 30, or however much "load more" has pulled in) and would
  // under-count a busy staff member's day until every one of today's
  // announcements happened to have been scrolled into view. The server
  // accumulates oldest-first per author; the feed here still displays
  // newest-first, so each row just looks up its own id regardless of
  // render order -- the most recent post of the day for someone shows
  // their full day's total so far, their first post shows just its own
  // duration.
  const [runningTotals, setRunningTotals] = useState<Record<number, number>>({})

  async function loadDailyTotal(day: string) {
    try {
      const res = await fetch(`/api/announcements/daily-totals?date=${day}`)
      if (!res.ok) return
      const d = await res.json()
      if (d && typeof d === 'object' && !Array.isArray(d)) {
        setRunningTotals(prev => ({ ...prev, ...d }))
      }
    } catch {}
  }

  // Merges rather than replaces, so posts loaded further back via "Load older"
  // don't get wiped out by the next 15s poll (which only ever asks for the
  // latest page) -- that was why older announcements used to disappear.
  function load() {
    loadDailyTotal(new Date().toISOString().slice(0, 10))
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
        for (const day of new Set(d.map(p => dayKey(p.created_at)))) loadDailyTotal(day)
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
  usePolling(load, 90000)

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
        <p className="text-[9px] text-gray-400 text-center py-3">No announcements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-[7px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-200">
                <th className="text-left pl-2 pr-1 py-0.5 whitespace-nowrap">Time</th>
                <th className="text-left px-1 py-0.5">Activity</th>
                <th className="text-right px-1 py-0.5 whitespace-nowrap">Qty</th>
                <th className="text-right px-1 py-0.5 whitespace-nowrap" title="Time since the previous logged activity">Gap</th>
                <th className="text-left px-1 py-0.5 whitespace-nowrap">Staff</th>
                <th className="text-left px-1 py-0.5 whitespace-nowrap">Duration</th>
                <th className="text-left px-1 py-0.5 whitespace-nowrap">Total</th>
                <th className="text-left px-1 py-0.5 whitespace-nowrap">Item</th>
                <th className="text-right px-1 py-0.5 whitespace-nowrap">SP</th>
                <th className="text-right px-1 py-0.5 whitespace-nowrap">CP</th>
                <th className="text-right px-1 py-0.5 whitespace-nowrap">PF</th>
                <th className="text-right px-1 pr-2 py-0.5 whitespace-nowrap">SOH</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p, i) => (
                <PostRow key={p.id} p={p}
                  showDateHeader={i === 0 || dayKey(p.created_at) !== dayKey(posts[i - 1].created_at)}
                  gapMins={gapMinsFor(posts, i)}
                  staffDayTotalSeconds={runningTotals[p.id] ?? 0}
                  canDelete={canDelete} onDelete={removePost} />
              ))}
              {hasMore && <tr><td colSpan={FEED_COLUMNS}><div ref={sentinelRef} className="h-1" /></td></tr>}
              {loadingMore && <tr><td colSpan={FEED_COLUMNS} className="text-[7px] text-gray-400 text-center py-2">Loading…</td></tr>}
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
