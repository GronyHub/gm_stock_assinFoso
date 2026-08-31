'use client'
import { useEffect, useState } from 'react'
import { parseTimeMins } from '@/lib/staffTimes'

type StaffRow = { staff_name: string; actual_in: string; worked_seconds: number }

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

// Sits right above the mode-switch tabs: every staff member currently
// clocked in (actual_in set, no actual_out yet today), shown as
// "Joe(2hr/5hr 10min)" -- worked time over total time since clock-in.
// Worked time comes from /api/staff-times/worked-today, which sums today's
// announcements' estimated_duration_seconds (real for live sale taps, a
// flat 1 minute for a stock count or a violation fix, zero for anything
// else); total time is just now minus their own actual_in. Polls for new
// activity/clock changes and ticks its own clock independently so the
// total keeps moving between polls.
export default function PresentStaffBar() {
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [now, setNow] = useState(() => new Date())

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
    <div className="px-2 py-1 border-b border-gray-200 bg-gray-50 flex items-center gap-2.5 flex-wrap text-[10px] shrink-0">
      <span className="font-semibold text-gray-400 shrink-0">Present</span>
      {staff.map(s => {
        const inMins = parseTimeMins(s.actual_in)
        const totalMins = inMins != null ? Math.max(0, nowMins - inMins) : null
        const workedMins = s.worked_seconds / 60
        return (
          <span key={s.staff_name} className="whitespace-nowrap">
            <span className="font-semibold text-gray-700">{s.staff_name}</span>
            {totalMins != null && (
              <span className="text-gray-400">({fmtHrMin(workedMins)}/{fmtHrMin(totalMins)})</span>
            )}
          </span>
        )
      })}
    </div>
  )
}
