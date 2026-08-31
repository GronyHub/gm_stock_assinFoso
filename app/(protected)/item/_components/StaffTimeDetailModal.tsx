'use client'
import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/fmtDuration'
import { fmtClockTime } from '@/lib/clockTime'

type ActivityRow = { id: number; body: string; created_at: string; duration_seconds: number; running_total_seconds: number }
type Detail = {
  staff: string; date: string
  actual_in: string | null; actual_out: string | null
  total_seconds: number
  activity: ActivityRow[]
}

// Opened by tapping a name in PresentStaffBar -- that staff member's own
// itemized activity for today (Time/Activity/Dur/Total, same shape as
// Home's own feed table), backed by /api/staff-times/worked-detail so the
// numbers here always match what the pill itself is summarizing.
export default function StaffTimeDetailModal({ staffName, onClose }: { staffName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/staff-times/worked-detail?staff=${encodeURIComponent(staffName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setDetail(d) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [staffName])

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <p className="text-sm font-bold text-gray-900 capitalize">{staffName}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
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
              <span className="font-semibold text-gray-700">Total {formatDuration(detail.total_seconds)}</span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-auto">
              {detail.activity.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-6">No recorded activity today.</p>
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
