'use client'
import { useEffect, useState } from 'react'

type Entry = { id: number; staff_name: string; rota_date: string; sched_in: string | null; sched_out: string | null; is_off: boolean; role: string | null }
const ROLE: Record<string, string> = { opener: 'Opener', closer: 'Closer' }

// One person's rota: their shifts for the month (the same rota the Shop shows for the whole team).
export default function PersonRota({ staff }: { staff: string }) {
  const now = new Date()
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 })
  const [rows, setRows] = useState<Entry[] | null>(null)
  useEffect(() => {
    setRows(null)
    fetch(`/api/rota?year=${ym.y}&month=${ym.m}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : []).then((d: Entry[]) => setRows(Array.isArray(d) ? d.filter(e => e.staff_name.toLowerCase() === staff.toLowerCase()) : [])).catch(() => setRows([]))
  }, [ym, staff])
  const step = (n: number) => setYm(p => { const d = new Date(p.y, p.m - 1 + n, 1); return { y: d.getFullYear(), m: d.getMonth() + 1 } })
  const today = new Date().toISOString().slice(0, 10)
  const label = new Date(ym.y, ym.m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const worked = (rows ?? []).filter(e => !e.is_off)
  return (
    <div className="space-y-2 p-2">
      <div className="flex items-center gap-2 rounded-xl bg-[#14213D] px-3 py-2 text-white">
        <button type="button" onClick={() => step(-1)} className="rounded-lg bg-white/15 px-3 py-1 text-lg font-bold">‹</button>
        <div className="flex-1 text-center"><p className="text-sm font-bold">{label}</p><p className="text-[11px] text-blue-200">{worked.length} shift{worked.length === 1 ? '' : 's'}</p></div>
        <button type="button" onClick={() => step(1)} className="rounded-lg bg-white/15 px-3 py-1 text-lg font-bold">›</button>
      </div>
      {rows === null && <p className="text-sm text-gray-400">Loading…</p>}
      {rows && rows.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">No rota has been made for this month yet.</p>}
      <div className="space-y-1">{(rows ?? []).map(e => (
        <div key={e.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${e.rota_date === today ? 'border-2 border-blue-500 bg-blue-50' : e.is_off ? 'bg-gray-50 text-gray-400' : 'bg-white border border-gray-200'}`}>
          <span className="w-24 shrink-0 font-bold">{new Date(e.rota_date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}</span>
          <span className="flex-1 font-semibold">{e.is_off ? 'Off' : `${e.sched_in ?? '?'} to ${e.sched_out ?? '?'}`}</span>
          {!e.is_off && e.role && ROLE[e.role] && <span className="rounded-full bg-indigo-100 px-2 py-px text-[10px] font-bold text-indigo-800">{ROLE[e.role]}</span>}
        </div>))}</div>
    </div>
  )
}
