'use client'
import { useEffect, useState } from 'react'
import { formatDuration } from '@/lib/fmtDuration'

type Entry = { id: number; staff_name: string; rota_date: string; sched_in: string | null; sched_out: string | null; is_off: boolean; role: string | null }
type Day = { actual_in: string | null; actual_out: string | null; total_seconds: number }

// Today and the days to come: the shifts planned on the rota, with today's real clock status joined to today's row. Their recorded past is below it.
export default function PersonUpcoming({ staff }: { staff: string }) {
  const [rows, setRows] = useState<Entry[] | null>(null)
  const [today, setToday] = useState<Day | null>(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  useEffect(() => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    Promise.all([now, next].map(d => fetch(`/api/rota?year=${d.getFullYear()}&month=${d.getMonth() + 1}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : [])))
      .then(([a, b]) => {
        const end = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10)
        setRows([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter((e: Entry) => e.staff_name.toLowerCase() === staff.toLowerCase() && e.rota_date >= todayKey && e.rota_date <= end).sort((x: Entry, y: Entry) => x.rota_date.localeCompare(y.rota_date)))
      }).catch(() => setRows([]))
    fetch(`/api/staff-times/worked-detail?staff=${encodeURIComponent(staff)}&date=${todayKey}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setToday).catch(() => {})
  }, [staff, todayKey])
  if (!rows) return null
  const planned = rows.find(e => e.rota_date === todayKey)
  const clock = today?.actual_in ? `Clocked in ${today.actual_in}${today.actual_out ? ` · out ${today.actual_out}` : ''} · worked ${formatDuration(today.total_seconds)}` : null
  if (!rows.length && !clock) return null
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50">
      <p className="bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">Today and coming up · planned on the rota</p>
      <div className="divide-y divide-blue-100">
        {!planned && clock && <div className="px-3 py-1 text-xs"><span className="font-bold text-blue-900">Today</span> <span className="text-gray-700">· {clock}</span></div>}
        {rows.map(e => (
          <div key={e.id} className="px-3 py-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-24 shrink-0 font-bold text-blue-900">{e.rota_date === todayKey ? 'Today' : new Date(e.rota_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
              <span className={`flex-1 font-semibold italic ${e.is_off ? 'text-gray-400 not-italic' : 'text-blue-700'}`}>{e.is_off ? 'Off' : `${e.sched_in ?? '?'} to ${e.sched_out ?? '?'}`}</span>
              {!e.is_off && (e.role === 'opener' || e.role === 'closer') && <span className="rounded-full bg-indigo-100 px-2 py-px text-[10px] font-bold capitalize text-indigo-800">{e.role}</span>}
            </div>
            {e.rota_date === todayKey && clock && <p className="mt-0.5 text-[11px] text-gray-700">{clock}</p>}
          </div>))}
      </div>
    </div>
  )
}
