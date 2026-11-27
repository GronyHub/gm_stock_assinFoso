'use client'
import { useEffect, useState } from 'react'

type Row = { item_id: number; name: string; times: number; qty: number; amt: number; last: string }
type Data = { period: string; total: number; count: number; rows: Row[] }
const c = (v: number) => `₵${Math.round(v).toLocaleString('en-GH')}`
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const PERIODS = [['30', '30 days'], ['year', 'This year'], ['all', 'All time']] as const
const cache = new Map<string, Data>()

// Which items lose the most money: ranked by ₵ lost over a period. A tap opens the item's Stock tab (its loss history and the count entry). Open to everyone.
export default function BiggestLosses({ onPick }: { onPick: (itemId: number) => void }) {
  const [period, setPeriod] = useState<'30' | 'year' | 'all'>('30')
  const [data, setData] = useState<Data | null>(cache.get('30') ?? null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
    const hit = cache.get(period); if (hit) { setData(hit); return }
    setData(null)
    fetch(`/api/losses/ranking?period=${period}`).then(r => (r.ok ? r.json() : Promise.reject())).then((d: Data) => { cache.set(period, d); setData(d) }).catch(() => setFailed(true))
  }, [period])
  return (
    <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <p className="mr-auto text-sm font-bold text-gray-900">Biggest losses</p>
        {PERIODS.map(([k, label]) => <button key={k} type="button" onClick={() => setPeriod(k)} className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${period === k ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>)}
      </div>
      {failed && <p className="text-[13px] text-red-600">Could not load. Try again in a moment.</p>}
      {!failed && !data && <p className="text-[13px] text-gray-500">Loading…</p>}
      {data && (<>
        <p className="mb-1 text-[12px] text-gray-500">{data.count} item{data.count === 1 ? '' : 's'} lost {c(data.total)} in this period. Tap one to open its loss history.</p>
        {data.rows.length === 0 ? <p className="py-3 text-center text-[13px] text-gray-500">No losses in this period.</p> : (
          <div className="divide-y divide-gray-100">
            {data.rows.map((r, i) => (
              <button key={r.item_id} type="button" onClick={() => onPick(r.item_id)} className="flex w-full items-center gap-2 py-1.5 text-left active:bg-gray-50">
                <span className="w-5 shrink-0 text-right text-[12px] font-bold text-gray-400">{i + 1}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-gray-900">{r.name}</span><span className="block text-[11px] text-gray-500">{r.times} time{r.times === 1 ? '' : 's'} · {Math.round(r.qty * 100) / 100} short · latest {dayLabel(r.last)}</span></span>
                <span className="shrink-0 text-[13px] font-extrabold text-red-600">{c(r.amt)}</span>
              </button>))}
          </div>)}
      </>)}
    </div>
  )
}
