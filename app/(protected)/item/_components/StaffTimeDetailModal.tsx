'use client'
import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/fmtDuration'
import { fmtClockTime } from '@/lib/clockTime'
import { parseTimeMins } from '@/lib/staffTimes'
import { fmtDate } from '@/lib/fmtDate'

type ActivityRow = { id: number; body: string; created_at: string; duration_seconds: number; running_total_seconds: number }
type Detail = {
  staff: string; date: string
  actual_in: string | null; actual_out: string | null
  total_seconds: number
  activity: ActivityRow[]
}

// Ghana is UTC+0 year-round (no DST), so the UTC calendar date IS the Ghana
// calendar date -- see lib/fmtDate.ts's own comment on this.
function ghanaToday(): string {
  return new Date().toISOString().slice(0, 10)
}
function shiftDate(date: string, deltaDays: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

// How long the clock-in/out pair actually spans -- "Present" -- as opposed
// to "Worked" (detail.total_seconds, the sum of the day's actual task
// durations). The gap between the two is the point of showing both: it's
// what tells you whether someone was present but idle, not just present.
function presentSeconds(detail: Detail, isToday: boolean): number | null {
  const inMins = parseTimeMins(detail.actual_in)
  if (inMins == null) return null
  if (detail.actual_out) {
    const outMins = parseTimeMins(detail.actual_out)
    if (outMins == null) return null
    return (outMins >= inMins ? outMins - inMins : (outMins + 1440) - inMins) * 60
  }
  if (!isToday) return null // clocked in but never out, and not still ongoing
  const nowMins = new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
  return Math.max(0, nowMins - inMins) * 60
}

// Opened by tapping a name in PresentStaffBar -- that staff member's own
// itemized activity for a given day (Time/Activity/Dur/Total, same shape as
// Home's own feed table), backed by /api/staff-times/worked-detail so the
// numbers here always match what the pill itself is summarizing. Defaults to
// today; the ◀/▶ arrows below step through previous days.
export default function StaffTimeDetailModal({ staffName, onClose }: { staffName: string; onClose: () => void }) {
  const [date, setDate] = useState(ghanaToday())
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const isToday = date === ghanaToday()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/staff-times/worked-detail?staff=${encodeURIComponent(staffName)}&date=${date}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [staffName, date])

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <p className="text-sm font-bold text-gray-900 capitalize">{staffName}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100 shrink-0">
          <button onClick={() => setDate(d => shiftDate(d, -1))}
            className="text-gray-400 hover:text-gray-700 font-bold px-1.5 leading-none">‹</button>
          <p className="text-[11px] font-semibold text-gray-700">{isToday ? 'Today' : fmtDate(date)}</p>
          <button onClick={() => setDate(d => shiftDate(d, 1))} disabled={isToday}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:hover:text-gray-400 font-bold px-1.5 leading-none">›</button>
        </div>
        {loading ? (
          <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>
        ) : !detail ? (
          <p className="text-[11px] text-gray-400 text-center py-6">Could not load time details.</p>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between text-[10px] text-gray-500 shrink-0">
              <span>
                Clocked in {detail.actual_in ?? '—'}
                {detail.actual_out ? ` · out ${detail.actual_out}` : ''}
              </span>
              <span className="text-right">
                <span className="block text-gray-400">Present {(() => {
                  const s = presentSeconds(detail, isToday)
                  return s == null ? '—' : formatDuration(s)
                })()}</span>
                <span className="block font-semibold text-gray-700">Worked {formatDuration(detail.total_seconds)}</span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              {detail.activity.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-6">No recorded activity {isToday ? 'today' : 'on this day'}.</p>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-white">
                    <tr className="text-[7px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-200">
                      <th className="text-left pl-3 pr-1 py-1 whitespace-nowrap">Time</th>
                      <th className="text-left px-1 py-1">Activity</th>
                      <th className="text-left px-1 py-1 whitespace-nowrap">Dur</th>
                      <th className="text-left px-1 pr-3 py-1 whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.activity.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50">
                        <td className="pl-3 pr-1 py-0.5 text-[8px] text-gray-400 whitespace-nowrap">{fmtClockTime(a.created_at)}</td>
                        <td className="px-1 py-0.5 text-[8px] text-gray-800 whitespace-nowrap">{a.body}</td>
                        <td className="px-1 py-0.5 text-[8px] text-gray-400 whitespace-nowrap">{a.duration_seconds > 0 ? formatDuration(a.duration_seconds) : '—'}</td>
                        <td className="px-1 pr-3 py-0.5 text-[8px] text-gray-500 font-semibold whitespace-nowrap">{formatDuration(a.running_total_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
