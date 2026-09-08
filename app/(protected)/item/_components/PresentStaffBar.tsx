'use client'
import { useEffect, useState } from 'react'
import { parseTimeMins } from '@/lib/staffTimes'
import { usePolling } from '@/lib/usePolling'
import StaffTimeDetailModal from './StaffTimeDetailModal'

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
// figures across everyone shown, same format as each person's own entry.
// Polls for new activity/clock changes and ticks its own clock every 30
// seconds.
export default function PresentStaffBar() {
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
      <div className="px-2 py-1 border-b border-gray-200 bg-gray-50 flex items-center gap-2.5 flex-wrap text-[10px] shrink-0">
        {computed.map(s => (
          <button key={s.staff_name} type="button" onClick={() => setSelectedStaff(s.staff_name)}
            title="View time details" className={`whitespace-nowrap hover:underline ${s.isLoggedOut ? 'opacity-60' : ''}`}>
            <span className="font-semibold text-gray-700">{s.staff_name}</span>
            {s.isLoggedOut && <span className="text-gray-400"> (out)</span>}
            {s.totalMins != null && (
              <span className="text-gray-400">({fmtHrMin(s.workedMins)}/{fmtHrMin(s.totalMins)})</span>
            )}
          </button>
        ))}
        <span className="whitespace-nowrap border-l border-gray-300 pl-2.5">
          <span className="font-semibold text-gray-700">Total</span>
          <span className="text-gray-400">({fmtHrMin(totalWorkedMins)}/{fmtHrMin(totalPresentMins)})</span>
        </span>
      </div>
      {selectedStaff && (
        <StaffTimeDetailModal staffName={selectedStaff} onClose={() => setSelectedStaff(null)} />
      )}
    </>
  )
}
