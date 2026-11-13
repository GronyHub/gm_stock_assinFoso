'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { parseTimeMins } from '@/lib/staffTimes'
import { usePolling } from '@/lib/usePolling'
import StaffAvatar from '@/components/StaffAvatar'

const TodayContent = dynamic(() => import('./TodayContent'), { ssr: false, loading: () => <p className="py-10 text-center text-gray-400 text-xs">Loading…</p> })

type StaffRow = { staff_name: string; actual_in: string; actual_out: string | null; on_break: boolean; worked_seconds: number }
type RosterEntry = { username: string; active: boolean; photo_url?: string | null }
type Status = 'present' | 'break' | 'out' | 'absent'

// "2hr 10min" / "45min" / "3hr" -- deliberately "hr"/"min" rather than
// lib/fmtDuration.ts's "2h 30m" (that one's shared with the Log tab's Time
// column, a different, denser context).
function fmtHrMin(totalMinutes: number): string {
  const mins = Math.max(0, Math.round(totalMinutes))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return `${h}hr ${m}min`
  if (h > 0) return `${h}hr`
  return `${m}min`
}

// Sits right above the mode-switch tabs: one chip per active staff member
// (see `roster`, the same list backing the pane's own "Staff Members"
// section), not just whoever's clocked in today -- the whole point is being
// able to see everyone's status (and tap through to their tasks/duties) at a
// glance, including who hasn't shown up. A colored dot carries that status:
// green = present (clocked in, not on break), red = on break, clocked out,
// or never clocked in today at all -- absent additionally gets its name
// struck through, since "not here at all" reads differently from "was here,
// stepped away". Worked time comes from /api/staff-times/worked-today, which
// sums today's announcements' estimated_duration_seconds; total time is from
// clock-in to now (or to clock-out time if already logged out) -- neither
// applies to someone absent, so their chip has no second line. A trailing
// "Total" entry sums both figures across everyone actually present today,
// same format as each person's own entry -- clicking it opens Home as an
// inline modal (same treatment as a per-person chip below) rather than
// navigating away to it, since Home's own announcement feed is the actual
// activity record the worked-time half of every figure here is summed
// from. Tapping a person's own chip instead opens their whole personal
// page (StaffMemberModal -- the same page the pane's own "Staff Members"
// row opens, just as a modal here), landing on its Times tab, rather than
// a narrow detail-only modal -- this works identically whether they're
// present or absent today. Polls for new activity/clock/break changes and
// ticks its own clock every 30 seconds.
export default function PresentStaffBar({ roster, selfName, onOpenStaff, onOpenShop, embedded, vertical, salesTotal, salesBy, waitingBy, activeStaff, shopActive }: {
  // Phone: slim rows lined up in the left sidebar under the signed-in person's own button (photo with status ring, points, sales; no names, no hours -- tap a row for their times).
  vertical?: boolean
  activeStaff?: string | null   // the person whose profile is open: their button is highlighted like the selected item in the left sidebar
  shopActive?: boolean          // the Shop is open
  // What each person has recorded today (lowercase name -> cedis), from the hub's own live sale list.
  salesBy?: Record<string, number>
  // Tapping the Shop box (was Total) opens the hub's Shop page: Waiting for team, Company Laws, Home, Manage.
  onOpenShop?: () => void
  // For supervisors: how many things wait for each person (lowercase name), shown as a red count on their avatar.
  waitingBy?: Record<string, { total: number; now: number }>
  roster: RosterEntry[]
  // The signed-in person (their button is the one at the top of the sidebar, so it is left out here) and what to do when a chip is tapped:
  // the hub opens that person's page in its right pane.
  selfName: string
  onOpenStaff: (name: string, tab?: string) => void
  // True when portaled into Nav's own top bar (desktop only -- see
  // lib/navSlot.ts and item/page.tsx) instead of rendered as this
  // component's usual standalone full-width row: drops the border/
  // background/padding that made sense as a lone row but would otherwise
  // read as a floating box sitting inside Nav's own strip.
  embedded?: boolean
  // Today's running sales total, already formatted (e.g. "₵1,014"). Desktop
  // shows this as its own bold badge ahead of this whole bar (see
  // item/page.tsx's navSlotEl portal) since Nav's strip has room to spare --
  // mobile doesn't have an equivalent second place to put it, so on request
  // it renders right here instead, next to the Total chip it's most related
  // to, rather than costing its own extra row above this one.
  salesTotal?: string
}) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [now, setNow] = useState(() => new Date())
  const [homeModalOpen, setHomeModalOpen] = useState(false)
  useEffect(() => {
    let cancelled = false
    function load() {
      fetch('/api/staff-times/worked-today').then(r => r.ok ? r.json() : null).then(d => {
        if (!cancelled && Array.isArray(d?.staff)) setStaff(d.staff)
      }).catch(() => {})
    }
    load()
    return () => { cancelled = true }
  }, [])
  // Worked-time totals don't need second-level freshness -- was a raw
  // setInterval with no pause-when-hidden guard, unlike every other poll in
  // the app (see usePolling's own comment), so a forgotten background tab
  // kept hitting the database every 60s indefinitely. This bar is always
  // mounted (sits above the mode-switch tabs regardless of which tab is
  // open), so it was one of the steadiest Neon compute-hour drivers. Bumped
  // to the same 10-minute "background data" tier used everywhere else, past
  // Neon's 5-minute auto-suspend window, so a quiet moment can actually let
  // the database sleep.
  usePolling(() => {
    fetch('/api/staff-times/worked-today').then(r => r.ok ? r.json() : null).then(d => {
      if (Array.isArray(d?.staff)) setStaff(d.staff)
    }).catch(() => {})
  }, 600000)

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(tick)
  }, [])

  const [pts, setPts] = useState<Record<string, number>>({})
  useEffect(() => {
    let live = true
    const load = () => fetch('/api/penalties/summary', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d?.points) setPts(d.points) }).catch(() => {})
    void load(); const t = setInterval(load, 5 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  if (roster.length === 0) return null

  // Ghana runs on UTC year-round with no DST, so "now in Ghana" is just UTC
  // now -- using getUTCHours/getUTCMinutes rather than the viewing device's
  // own local getters keeps elapsed time correct no matter what timezone
  // the device viewing this bar happens to be set to.
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes()

  // One entry per roster member (not per worked-today row) -- someone absent
  // has no row in `staff` at all, so they're matched by name (case-
  // insensitive: staff_times.staff_name and /api/staff/status's username
  // aren't guaranteed identical case, same reasoning as worked-today's own
  // author-matching) and just falls through to the 'absent' branch below.
  const computed = roster.map(r => {
    const match = staff.find(s => s.staff_name.toLowerCase() === r.username.toLowerCase())
    if (!match) {
      return { staff_name: r.username, photo_url: r.photo_url, status: 'absent' as Status, totalMins: null as number | null, workedMins: 0 }
    }
    const inMins = parseTimeMins(match.actual_in)
    const isLoggedOut = match.actual_out != null
    const totalMins = isLoggedOut
      ? (outMins => outMins != null && inMins != null ? outMins - inMins : null)(parseTimeMins(match.actual_out))
      : (inMins != null ? Math.max(0, nowMins - inMins) : null)
    const workedMins = match.worked_seconds / 60
    const status: Status = isLoggedOut ? 'out' : (match.on_break ? 'break' : 'present')
    return { staff_name: r.username, photo_url: r.photo_url, status, totalMins, workedMins }
  })
  const totalWorkedMins = computed.reduce((sum, c) => sum + c.workedMins, 0)
  const totalPresentMins = computed.reduce((sum, c) => sum + (c.totalMins ?? 0), 0)

  if (vertical) {
    const others = computed.filter(s => s.staff_name.toLowerCase() !== selfName.toLowerCase())
    return (
      <div className="flex flex-col gap-1 px-1 pt-1">
        {others.map(s => {
          const k = s.staff_name.toLowerCase(), w = waitingBy?.[k], p = pts[k]
          const on = !!activeStaff && activeStaff.toLowerCase() === k
          return (
            <button key={s.staff_name} type="button" data-keep-embed onClick={() => onOpenStaff(s.staff_name, 'times')}
              title={`${s.staff_name}: ${s.status === 'absent' ? 'not clocked in today' : s.status === 'break' ? 'on break' : s.status === 'out' ? 'clocked out' : 'clocked in'}${s.totalMins != null ? ` · ${fmtHrMin(s.workedMins)}/${fmtHrMin(s.totalMins)}` : ''}`}
              className={`relative flex w-full min-w-0 flex-col items-start gap-px rounded-lg px-1 py-0.5 text-left ${on ? 'bg-white/35 ring-2 ring-white' : 'bg-white/10 hover:bg-white/20'} ${s.status === 'absent' ? 'opacity-60' : ''}`}>
              {(w?.total ?? 0) > 0 && <span className={`absolute -right-1 -top-1 z-10 min-w-[16px] rounded-full px-1 text-center text-[9px] font-extrabold leading-4 text-white ${w!.now ? 'bg-red-600' : 'bg-amber-500'}`}>{w!.total > 99 ? '99+' : w!.total}</span>}
              <span className="flex w-full min-w-0 items-center gap-1">
                <span className={`shrink-0 rounded-full border-[3px] ${s.status === 'present' || s.status === 'break' ? 'border-green-500' : 'border-red-600'}`}><StaffAvatar name={s.staff_name} url={s.photo_url} size={18} /></span>
                {p !== undefined && <span className={`rounded-full px-1 py-px text-[8px] font-extrabold leading-none ${p >= 20 ? 'bg-red-600 text-white' : p >= 10 ? 'bg-amber-400 text-gray-900' : 'bg-green-500 text-white'}`}>⚖{p}</span>}
              </span>
              <span className="text-[10px] font-extrabold leading-tight text-green-300 tabular-nums">₵{((salesBy ?? {})[k] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </button>
          )
        })}
        <button type="button" data-keep-embed onClick={() => (onOpenShop ? onOpenShop() : setHomeModalOpen(true))} title={`The Shop: today's total sales · ${fmtHrMin(totalWorkedMins)}/${fmtHrMin(totalPresentMins)}`}
          className={`flex w-full min-w-0 flex-col items-start gap-px rounded-lg px-1 py-0.5 text-left ${shopActive ? 'bg-white/35 ring-2 ring-white' : 'bg-white/10 hover:bg-white/20'}`}>
          <span className="text-[10px] font-bold leading-tight text-white">🏪 Shop</span>
          {salesTotal && <span className="text-[10px] font-extrabold leading-tight text-green-300 tabular-nums">{salesTotal}</span>}
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Each entry is a small two-line chip (name, then worked/total on its
          own smaller line beneath) rather than one long inline string --
          stacking is what lets everyone plus Total actually fit on one row
          on a narrow phone screen instead of wrapping. flex-nowrap +
          overflow-x-auto is the fallback for whenever there are enough
          people to show at once that they still don't all fit -- scrolls
          sideways instead of wrapping to a second row either way. */}
      <div className={embedded
        ? 'flex items-stretch gap-1 flex-nowrap shrink-0'
        : 'px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-stretch gap-1 flex-nowrap overflow-x-auto shrink-0'}>
        {computed.filter(s => s.staff_name.toLowerCase() !== selfName.toLowerCase()).map(s => (
          <button key={s.staff_name} type="button" onClick={() => onOpenStaff(s.staff_name, 'times')}
            title={s.status === 'absent' ? 'Not clocked in today' : s.status === 'break' ? 'On break' : s.status === 'out' ? 'Clocked out' : 'View time details'}
            className={`relative shrink-0 flex flex-col items-center justify-center gap-px px-1.5 py-0.5 rounded-lg border shadow-sm transition ${activeStaff && activeStaff.toLowerCase() === s.staff_name.toLowerCase() ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-500' : 'border-gray-300 bg-white hover:bg-gray-100 active:bg-gray-200'} ${s.status === 'absent' ? 'opacity-60' : ''}`}>
            {(waitingBy?.[s.staff_name.toLowerCase()]?.total ?? 0) > 0 && <span title={`${waitingBy![s.staff_name.toLowerCase()].total} waiting for ${s.staff_name}${waitingBy![s.staff_name.toLowerCase()].now ? `, ${waitingBy![s.staff_name.toLowerCase()].now} overdue` : ''}`} className={`absolute -right-1 -top-1 z-10 min-w-[16px] rounded-full px-1 text-center text-[9px] font-extrabold leading-4 text-white ${waitingBy![s.staff_name.toLowerCase()].now ? 'bg-red-600' : 'bg-amber-500'}`}>{waitingBy![s.staff_name.toLowerCase()].total > 99 ? '99+' : waitingBy![s.staff_name.toLowerCase()].total}</span>}
            <span className="text-[10px] font-semibold text-gray-700 leading-tight whitespace-nowrap flex items-center gap-1">
              <span className={`shrink-0 rounded-full border-[3px] ${s.status === 'present' || s.status === 'break' ? 'border-green-500' : 'border-red-600'}`}><StaffAvatar name={s.staff_name} url={s.photo_url} size={18} /></span>
              <span className={`hidden sm:inline ${s.status === 'absent' ? 'line-through' : ''}`}>{s.staff_name}</span>
              {pts[s.staff_name.toLowerCase()] !== undefined && <span title={`${s.staff_name}: penalty points so far`} className={`rounded-full px-1 py-px text-[8px] font-extrabold leading-none ${pts[s.staff_name.toLowerCase()] >= 20 ? 'bg-red-600 text-white' : pts[s.staff_name.toLowerCase()] >= 10 ? 'bg-amber-400 text-gray-900' : 'bg-green-500 text-white'}`}>⚖{pts[s.staff_name.toLowerCase()]}</span>}
            </span>
            <span title="Sales this person has recorded today" className="text-[9px] font-extrabold text-green-700 leading-tight whitespace-nowrap tabular-nums">₵{((salesBy ?? {})[s.staff_name.toLowerCase()] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            {s.status !== 'absent' && s.totalMins != null && (
              <span className="text-[8px] text-gray-400 leading-tight whitespace-nowrap">{fmtHrMin(s.workedMins)}/{fmtHrMin(s.totalMins)}</span>
            )}
          </button>
        ))}
        <button type="button" onClick={() => (onOpenShop ? onOpenShop() : setHomeModalOpen(true))} title="Open the Shop: Waiting for team, Company Laws, Home"
          className={`shrink-0 flex flex-col items-center justify-center gap-px px-1.5 py-0.5 rounded-lg border shadow-sm transition ${shopActive ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-500' : 'border-gray-300 bg-gray-100 hover:bg-gray-200 active:bg-gray-300'}`}>
          <span className="text-[10px] font-semibold text-gray-700 leading-tight whitespace-nowrap">Shop</span>
          {/* Today's total sales sits inside this box, like each person's own amount sits in theirs. */}
          {salesTotal && <span title="Today's total sales so far" className="text-[10px] font-extrabold text-green-700 leading-tight whitespace-nowrap tabular-nums">{salesTotal}</span>}
          <span className="text-[8px] text-gray-400 leading-tight whitespace-nowrap">{fmtHrMin(totalWorkedMins)}/{fmtHrMin(totalPresentMins)}</span>
        </button>
      </div>
      {homeModalOpen && (
        <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={() => setHomeModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
              <p className="text-sm font-bold text-gray-900">🏠 Home</p>
              <button onClick={() => setHomeModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-2">
              <TodayContent />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
