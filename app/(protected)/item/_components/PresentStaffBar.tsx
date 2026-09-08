'use client'
import { useEffect, useState } from 'react'
import { parseTimeMins } from '@/lib/staffTimes'
import { usePolling } from '@/lib/usePolling'
import StaffMemberModal, { type StaffMemberModalProps } from './StaffMemberModal'

type StaffRow = { staff_name: string; actual_in: string; actual_out: string | null; worked_seconds: number }

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

// Sits right above the mode-switch tabs: shows staff who have clocked in
// today, both currently clocked in and clocked out, displaying
// "Joe(2hr/5hr 10min)" for clocked-in and "Jane (out)(1hr/3hr)" for
// clocked-out. No "Present" label any more -- a staff name showing up here
// at all already means present, the word was redundant. Worked time comes
// from /api/staff-times/worked-today, which sums today's announcements'
// estimated_duration_seconds; total time is from clock-in to now (or to
// clock-out time if already logged out). A trailing "Total" entry sums both
// figures across everyone shown, same format as each person's own entry --
// clicking it opens Home (via onTotalClick) rather than a per-person detail
// modal, since Home's own announcement feed is the actual activity record
// the worked-time half of every figure here is summed from. Tapping a
// person's own chip instead opens their whole personal page (StaffMemberModal
// -- the same page the pane's own "Staff Members" row opens, just as a modal
// here), landing on its Times tab, rather than a narrow detail-only modal.
// Polls for new activity/clock changes and ticks its own clock every 30
// seconds.
export default function PresentStaffBar({ onTotalClick, staffMemberModalProps }: {
  onTotalClick?: () => void
  staffMemberModalProps: StaffMemberModalProps
}) {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [now, setNow] = useState(() => new Date())
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)

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

  if (staff.length === 0) return null

  // Ghana runs on UTC year-round with no DST, so "now in Ghana" is just UTC
  // now -- using getUTCHours/getUTCMinutes rather than the viewing device's
  // own local getters keeps elapsed time correct no matter what timezone
  // the device viewing this bar happens to be set to.
  const nowMins = now.getUTCHours() * 60 + now.getUTCMinutes()

  // Computed once per render (rather than inline in the .map() below) so
  // the same per-person worked/total minutes can also feed the "Total"
  // summary's sums without recomputing them a second time.
  const computed = staff.map(s => {
    const inMins = parseTimeMins(s.actual_in)
    const isLoggedOut = s.actual_out != null
    const totalMins = isLoggedOut
      ? (outMins => outMins != null && inMins != null ? outMins - inMins : null)(parseTimeMins(s.actual_out))
      : (inMins != null ? Math.max(0, nowMins - inMins) : null)
    const workedMins = s.worked_seconds / 60
    return { staff_name: s.staff_name, isLoggedOut, totalMins, workedMins }
  })
  const totalWorkedMins = computed.reduce((sum, c) => sum + c.workedMins, 0)
  const totalPresentMins = computed.reduce((sum, c) => sum + (c.totalMins ?? 0), 0)

  return (
    <>
      {/* Each entry is a small two-line chip (name, then worked/total on its
          own smaller line beneath) rather than one long inline string --
          stacking is what lets everyone plus Total actually fit on one row
          on a narrow phone screen instead of wrapping. flex-nowrap +
          overflow-x-auto is the fallback for whenever there are enough
          people clocked in at once that they still don't all fit -- scrolls
          sideways instead of wrapping to a second row either way. */}
      <div className="px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-stretch gap-1 flex-nowrap overflow-x-auto shrink-0">
        {computed.map(s => (
          <button key={s.staff_name} type="button" onClick={() => setSelectedStaff(s.staff_name)}
            title="View time details"
            className={`shrink-0 flex flex-col items-center justify-center gap-px px-1.5 py-0.5 rounded-lg border border-gray-300 bg-white shadow-sm hover:bg-gray-100 active:bg-gray-200 transition ${s.isLoggedOut ? 'opacity-60' : ''}`}>
            <span className="text-[10px] font-semibold text-gray-700 leading-tight whitespace-nowrap">
              {s.staff_name}{s.isLoggedOut ? ' (out)' : ''}
            </span>
            {s.totalMins != null && (
              <span className="text-[8px] text-gray-400 leading-tight whitespace-nowrap">{fmtHrMin(s.workedMins)}/{fmtHrMin(s.totalMins)}</span>
            )}
          </button>
        ))}
        <button type="button" onClick={onTotalClick} disabled={!onTotalClick} title="Open Home"
          className="shrink-0 flex flex-col items-center justify-center gap-px px-1.5 py-0.5 rounded-lg border border-gray-300 bg-gray-100 shadow-sm hover:bg-gray-200 active:bg-gray-300 transition disabled:hover:bg-gray-100">
          <span className="text-[10px] font-semibold text-gray-700 leading-tight whitespace-nowrap">Total</span>
          <span className="text-[8px] text-gray-400 leading-tight whitespace-nowrap">{fmtHrMin(totalWorkedMins)}/{fmtHrMin(totalPresentMins)}</span>
        </button>
      </div>
      {selectedStaff && (
        <StaffMemberModal staffName={selectedStaff} onClose={() => setSelectedStaff(null)} {...staffMemberModalProps} />
      )}
    </>
  )
}
