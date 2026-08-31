'use client'
import { useEffect, useState } from 'react'
import { parseTimeMins } from '@/lib/staffTimes'
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
// clocked-out. Worked time comes from /api/staff-times/worked-today, which
// sums today's announcements' estimated_duration_seconds; total time is
// from clock-in to now (or to clock-out time if already logged out). Polls
// for new activity/clock changes and ticks its own clock every 30 seconds.
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
    const poll = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(poll) }
  }, [])

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(tick)
  }, [])

  if (staff.length === 0) return null

  const nowMins = now.getHours() * 60 + now.getMinutes()

  return (
    <>
      <div className="px-2 py-1 border-b border-gray-200 bg-gray-50 flex items-center gap-2.5 flex-wrap text-[10px] shrink-0">
        <span className="font-semibold text-gray-400 shrink-0">Present</span>
        {staff.map(s => {
          const inMins = parseTimeMins(s.actual_in)
          const isLoggedOut = s.actual_out != null
          const totalMins = isLoggedOut
            ? (outMins => outMins != null && inMins != null ? outMins - inMins : null)(parseTimeMins(s.actual_out))
            : (inMins != null ? Math.max(0, nowMins - inMins) : null)
          const workedMins = s.worked_seconds / 60
          return (
            <button key={s.staff_name} type="button" onClick={() => setSelectedStaff(s.staff_name)}
              title="View time details" className={`whitespace-nowrap hover:underline ${isLoggedOut ? 'opacity-60' : ''}`}>
              <span className="font-semibold text-gray-700">{s.staff_name}</span>
              {isLoggedOut && <span className="text-gray-400"> (out)</span>}
              {totalMins != null && (
                <span className="text-gray-400">({fmtHrMin(workedMins)}/{fmtHrMin(totalMins)})</span>
              )}
            </button>
          )
        })}
      </div>
      {selectedStaff && (
        <StaffTimeDetailModal staffName={selectedStaff} onClose={() => setSelectedStaff(null)} />
      )}
    </>
  )
}
