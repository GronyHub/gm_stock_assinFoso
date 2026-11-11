'use client'
import { useEffect, useState } from 'react'

type Entry = { id: number; staff_name: string; rota_date: string; sched_in: string | null; sched_out: string | null; is_off: boolean; role: string | null }

// A person's shifts for the days to come (from the rota), shown above their recorded times so the past, today and the future are all on one page.
export default function PersonUpcoming({ staff }: { staff: string }) {
  const [rows, setRows] = useState<Entry[] | null>(null)
  useEffect(() => {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    Promise.all([now, next].map(d => fetch(`/api/rota?year=${d.getFullYear()}&month=${d.getMonth() + 1}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : [])))
      .then(([a, b]) => {
        const today = now.toISOString().slice(0, 10), end = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10)
        setRows([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])].filter((e: Entry) => e.staff_name.toLowerCase() === staff.toLowerCase() && e.rota_date >= today && e.rota_date <= end).sort((x: Entry, y: Entry) => x.rota_date.localeCompare(y.rota_date)))
      }).catch(() => setRows([]))
  }, [staff])
  if (!rows || !rows.length) return null
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/50">
      <p className="bg-blue-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700">Coming up · planned on the rota</p>
      <div className="divide-y divide-blue-100">{rows.map(e => (
        <div key={e.id} className="flex items-center gap-2 px-3 py-1 text-xs">
          <span className="w-24 shrink-0 font-bold text-blue-900">{e.rota_date === today ? 'Today' : new Date(e.rota_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
          <span className={`flex-1 font-semibold italic ${e.is_off ? 'text-gray-400 not-italic' : 'text-blue-700'}`}>{e.is_off ? 'Off' : `${e.sched_in ?? '?'} to ${e.sched_out ?? '?'}`}</span>
          {!e.is_off && (e.role === 'opener' || e.role === 'closer') && <span className="rounded-full bg-indigo-100 px-2 py-px text-[10px] font-bold capitalize text-indigo-800">{e.role}</span>}
        </div>))}</div>
    </div>
  )
}
