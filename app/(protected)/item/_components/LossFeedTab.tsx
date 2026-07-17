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

// Chronological feed of every loss (or, with kind="gain", every gain) as it
// was detected -- newest count first. An item with three events on different
// days appears three times, each in its own place in the timeline. Gains are
// listed the same way because every gain is a record error that Joe must fix
// until this list is empty.
export default function LossFeedTab({ search, kind = 'loss' }: { search: string; kind?: 'loss' | 'gain' }) {
  const [events, setEvents] = useState<LossEvent[]>([])
  const [loading, setLoading] = useState(true)
  const isGain = kind === 'gain'

  useEffect(() => {
    fetch(`/api/losses/events${isGain ? '?kind=gain' : ''}`)
      .then(r => r.json())
      .then(d => { setEvents(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const filtered = useMemo(() => {
    if (!search.trim()) return events
    const q = search.toLowerCase()
    return events.filter(e => e.item_name.toLowerCase().includes(q))
  }, [events, search])

  const totalAmt = useMemo(() => filtered.reduce((s, e) => s + e.loss_amt, 0), [filtered])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const sign = isGain ? '+' : '-'
  const valueCls = isGain ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center justify-between px-3 py-1.5 border-b shrink-0 ${isGain ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
        <p className={`text-[10px] font-bold ${isGain ? 'text-amber-800' : 'text-red-800'}`}>
          {isGain
            ? `⚠ ${filtered.length} gain${filtered.length === 1 ? '' : 's'} on record — all should be 0; each one is a missing bill/GMC or a count error to fix`
            : `${filtered.length} loss${filtered.length === 1 ? '' : 'es'} detected`}
        </p>
        <p className={`text-[10px] font-bold shrink-0 ${isGain ? 'text-amber-800' : 'text-red-800'}`}>Total: ₵{fmtN(parseFloat(totalAmt.toFixed(2)))}</p>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">
            {isGain ? 'No gains on record — all clean. 🎉' : 'No losses recorded. 🎉'}
          </p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 z-10">
              <tr className={`${isGain ? 'bg-amber-500' : 'bg-red-600'} text-white font-bold`}>
                <th className="text-left px-1.5 py-1 whitespace-nowrap">DATE</th>
                <th className="text-left px-1.5 py-1">ITEM</th>
                <th className="text-center px-1 py-1" title="Stock the records expected on that day">EXP</th>
                <th className="text-center px-1 py-1" title="What was physically counted">CNT</th>
                <th className="text-center px-1 py-1" title={isGain ? 'Counted minus expected — should always be 0' : 'Expected minus counted'}>{isGain ? 'GAIN' : 'LOSS'}</th>
                <th className="text-right px-1.5 py-1" title="Valued in cedis (4x6 papers at ₵20/sheet; other items at selling price)">{isGain ? 'GAIN ₵' : 'LOSS ₵'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e, i) => {
                const newDay = i === 0 || filtered[i - 1].date !== e.date
                return (
                  <tr key={`${e.item_id}-${e.date}`} className={`${newDay ? 'border-t-2 border-gray-300' : ''} bg-white ${isGain ? 'hover:bg-amber-50/50' : 'hover:bg-red-50/50'}`}>
                    <td className="px-1.5 py-1 font-bold text-gray-600 whitespace-nowrap">
                      {newDay ? fmtDate(e.date) : <span className="text-gray-300">〃</span>}
                    </td>
                    <td className="px-1.5 py-1 font-semibold text-gray-900">{e.item_name}</td>
                    <td className="px-1 py-1 text-center text-gray-500">{fmtN(e.expected)}</td>
                    <td className="px-1 py-1 text-center text-gray-900 font-semibold">{fmtN(e.counted)}</td>
                    <td className={`px-1 py-1 text-center font-bold ${valueCls}`}>{sign}{fmtN(e.loss_qty)}</td>
                    <td className={`px-1.5 py-1 text-right font-bold whitespace-nowrap ${valueCls}`}>{sign}₵{fmtN(e.loss_amt)}</td>
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
