'use client'
import { useEffect, useMemo, useState } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type LossEvent = {
  date: string
  item_id: number
  item_name: string
  expected: number
  counted: number
  loss_qty: number
  loss_amt: number
}

function fmtN(v: number) { return v % 1 === 0 ? String(v) : v.toFixed(2) }

// Chronological feed of every loss as it was detected -- newest count first.
// An item with three losses on different days appears three times, each in
// its own place in the timeline, so the running loss picture of the business
// reads top-down.
export default function LossFeedTab({ search }: { search: string }) {
  const [events, setEvents] = useState<LossEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/losses/events')
      .then(r => r.json())
      .then(d => { setEvents(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return events
    const q = search.toLowerCase()
    return events.filter(e => e.item_name.toLowerCase().includes(q))
  }, [events, search])

  const totalAmt = useMemo(() => filtered.reduce((s, e) => s + e.loss_amt, 0), [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-red-50 border-b border-red-100 shrink-0">
        <p className="text-[10px] font-bold text-red-800">
          {filtered.length} loss{filtered.length === 1 ? '' : 'es'} detected
        </p>
        <p className="text-[10px] font-bold text-red-800">Total: ₵{fmtN(parseFloat(totalAmt.toFixed(2)))}</p>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">No losses recorded. 🎉</p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-red-600 text-white font-bold">
                <th className="text-left px-1.5 py-1 whitespace-nowrap">DATE</th>
                <th className="text-left px-1.5 py-1">ITEM</th>
                <th className="text-center px-1 py-1" title="Stock the records expected on that day">EXP</th>
                <th className="text-center px-1 py-1" title="What was physically counted">CNT</th>
                <th className="text-center px-1 py-1" title="Expected minus counted">LOSS</th>
                <th className="text-right px-1.5 py-1" title="Loss valued in cedis (4x6 papers at ₵20/sheet; other items at selling price)">LOSS ₵</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e, i) => {
                const newDay = i === 0 || filtered[i - 1].date !== e.date
                return (
                  <tr key={`${e.item_id}-${e.date}`} className={`${newDay ? 'border-t-2 border-gray-300' : ''} bg-white hover:bg-red-50/50`}>
                    <td className="px-1.5 py-1 font-bold text-gray-600 whitespace-nowrap">
                      {newDay ? fmtDate(e.date) : <span className="text-gray-300">〃</span>}
                    </td>
                    <td className="px-1.5 py-1 font-semibold text-gray-900">{e.item_name}</td>
                    <td className="px-1 py-1 text-center text-gray-500">{fmtN(e.expected)}</td>
                    <td className="px-1 py-1 text-center text-gray-900 font-semibold">{fmtN(e.counted)}</td>
                    <td className="px-1 py-1 text-center font-bold text-red-600">-{fmtN(e.loss_qty)}</td>
                    <td className="px-1.5 py-1 text-right font-bold text-red-600 whitespace-nowrap">-₵{fmtN(e.loss_amt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
