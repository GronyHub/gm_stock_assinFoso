'use client'
import { Fragment, useEffect, useState } from 'react'
import { Card } from './analyticsShared'

type Month = { month: string; sales: string; gmc: string; cc: string | null; wnw: string | null; days: number | string; days_counted: number | string }
type Day = { day: string; sales: string; gmc: string; cc: string | null; wnw: string | null }
type Line = { id: number; item: string; quantity: string | null; item_price: string | null; item_total: string | null; is_gmc: boolean | null; customer_name: string | null }

const num = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? null : Number(v))
const money = (v: string | number | null | undefined) => { const x = num(v); return x === null ? '—' : `₵${x.toLocaleString('en-GH', { maximumFractionDigits: 0 })}` }
const money2 = (v: string | number | null | undefined) => { const x = num(v); return x === null ? '—' : `₵${x.toLocaleString('en-GH', { maximumFractionDigits: 2 })}` }
const wnwCls = (v: string | null) => { const x = num(v); return x === null ? 'text-gray-400' : x > 0 ? 'text-orange-600' : x < 0 ? 'text-red-600' : 'text-green-600' }
const monthName = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })

// Sales Log analytics: read-only day and month totals over the whole history (back to 2023), from the day
// receipts. Replaces the old Sales Rec / Summary screen. Pick a year, tap a month to see its days, tap a day to see
// what was sold. Each level loads only when opened.
export default function SalesDaysSection() {
  const [months, setMonths] = useState<Month[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [days, setDays] = useState<Record<string, Day[]>>({})
  const [err, setErr] = useState(false)
  const [year, setYear] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [lines, setLines] = useState<Record<string, Line[]>>({})
  function toggleDay(d: string) {
    setOpenDay(o => (o === d ? null : d))
    if (!lines[d]) {
      fetch(`/api/analysis/sales-days?day=${d}`).then(r => r.ok ? r.json() : Promise.reject())
        .then(x => setLines(prev => ({ ...prev, [d]: Array.isArray(x?.lines) ? x.lines : [] }))).catch(() => {})
    }
  }

  useEffect(() => {
    fetch('/api/analysis/sales-days').then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { const ms: Month[] = Array.isArray(d?.months) ? d.months : []; setMonths(ms); setYear(ms[0]?.month.slice(0, 4) ?? null) })
      .catch(() => setErr(true))
  }, [])
  function toggle(m: string) {
    setOpen(o => (o === m ? null : m))
    if (!days[m]) {
      fetch(`/api/analysis/sales-days?month=${m}`).then(r => r.ok ? r.json() : Promise.reject())
        .then(d => setDays(prev => ({ ...prev, [m]: Array.isArray(d?.days) ? d.days : [] }))).catch(() => {})
    }
  }

  return (
    <Card title="Days & months (read-only)" subtitle="Sales, GMC, cash counted (CC) and work not written (WNW), from the day receipts. Tap a month for its days. WNW counts only days whose cash was counted.">
      {err ? <p className="text-xs text-red-600">Could not load the totals.</p> : !months ? <p className="text-xs text-gray-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <div className="mb-1.5 flex flex-wrap gap-1">
            {[...new Set(months.map(m => m.month.slice(0, 4)))].map(y => (
              <button key={y} type="button" onClick={() => { setYear(y); setOpen(null); setOpenDay(null) }}
                className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${year === y ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{y}</button>
            ))}
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[12px] uppercase tracking-wide text-gray-500">
                <th className="py-1 pr-2 text-left">Month</th><th className="px-1 text-right">Sales</th><th className="px-1 text-right">GMC</th>
                <th className="px-1 text-right">CC</th><th className="px-1 text-right">WNW</th><th className="pl-1 text-right">Days counted</th>
              </tr>
            </thead>
            <tbody>
              {months.filter(m => !year || m.month.startsWith(year)).map(m => (<Fragment key={m.month}>
                <tr onClick={() => toggle(m.month)} className={`cursor-pointer border-t border-gray-100 hover:bg-blue-50 ${open === m.month ? 'bg-blue-50' : ''}`}>
                  <td className="py-1 pr-2 font-semibold text-gray-900">{open === m.month ? '▾' : '▸'} {monthName(m.month)}</td>
                  <td className="px-1 text-right font-semibold">{money(m.sales)}</td>
                  <td className="px-1 text-right text-purple-700">{money(m.gmc)}</td>
                  <td className="px-1 text-right">{money(m.cc)}</td>
                  <td className={`px-1 text-right font-semibold ${wnwCls(m.wnw)}`}>{money(m.wnw)}</td>
                  <td className="pl-1 text-right text-gray-500">{Number(m.days_counted)}/{Number(m.days)}</td>
                </tr>
                {open === m.month && (days[m.month] ? days[m.month].map(d => (<Fragment key={d.day}>
                  <tr onClick={() => toggleDay(d.day)} className={`cursor-pointer text-gray-700 hover:bg-blue-50 ${openDay === d.day ? 'bg-blue-50' : 'bg-gray-50'}`}>
                    <td className="py-0.5 pl-4 pr-2">{openDay === d.day ? '▾' : '▸'} {new Date(d.day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="px-1 text-right">{money(d.sales)}</td>
                    <td className="px-1 text-right text-purple-700">{num(d.gmc) ? money(d.gmc) : ''}</td>
                    <td className="px-1 text-right">{money(d.cc)}</td>
                    <td className={`px-1 text-right ${wnwCls(d.wnw)}`}>{money(d.wnw)}</td>
                    <td />
                  </tr>
                  {openDay === d.day && (
                    <tr><td colSpan={6} className="bg-white px-3 py-1">
                      {!lines[d.day] ? <p className="text-[12px] text-gray-400">Loading items…</p> : lines[d.day].length === 0 ? <p className="text-[12px] text-gray-400">No items recorded.</p> : (
                        <table className="w-full text-[12px]">
                          <tbody>
                            {lines[d.day].map(l => (
                              <tr key={l.id} className="border-b border-gray-50">
                                <td className="py-0.5 pr-2 text-gray-900">{l.item}{l.is_gmc ? <span className="ml-1 rounded bg-purple-100 px-1 text-[12px] font-bold text-purple-700">GMC</span> : null}</td>
                                <td className="px-1 text-right text-gray-500">{num(l.quantity) !== null ? `${Number(l.quantity)} ×` : ''}</td>
                                <td className="px-1 text-right text-gray-500">{num(l.item_price) !== null ? money2(l.item_price) : ''}</td>
                                <td className="pl-1 text-right font-semibold">{money2(l.item_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td></tr>
                  )}
                </Fragment>)) : <tr key={m.month + '-l'}><td colSpan={6} className="py-1 pl-4 text-gray-400">Loading days…</td></tr>)}
              </Fragment>))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
