'use client'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'
import { useColumnPrefs, ColumnsPickerButton, ColResizeHandle, type ColumnDef } from './columnPrefs'

const LOSS_FEED_COL_DEFAULTS: Record<string, number> = { date: 45, item: 90, expected: 35, counted: 35, lossQty: 35, lossAmt: 45 }

// Date + Item stay sticky/always-visible; these four are the only ones the
// picker can hide/reorder/rename. Labels flip between Loss/Gain wording
// depending on `kind`, same as the header already did.
type ColKey = 'expected' | 'counted' | 'lossQty' | 'lossAmt'

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
  const columns: (ColumnDef<ColKey> & { title: string })[] = [
    { key: 'expected', label: 'EXP', title: 'Stock the records expected on that day' },
    { key: 'counted',  label: 'CNT', title: 'What was physically counted' },
    { key: 'lossQty',  label: isGain ? 'GAIN' : 'LOSS', title: isGain ? 'Counted minus expected — should always be 0' : 'Expected minus counted' },
    { key: 'lossAmt',  label: isGain ? 'GAIN ₵' : 'LOSS ₵', title: 'Valued in cedis (4x6 papers at ₵20/sheet; other items at selling price)' },
  ]
  const colPrefs = useColumnPrefs<ColKey>(`lossFeed_${kind}`, columns)
  const colByKey = new Map(columns.map(c => [c.key, c]))

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

  // All-Time/Yesterday/This Week/Month/Year period totals -- used to live
  // pinned into the old Cash Tasks page's "Loss by Date" group; moved here
  // (loss feed only, not gains) now that Tasks is gone, since this is the
  // page that actually owns the loss data these summarize. Computed from
  // every fetched event regardless of the search box, same as before.
  const periodSummary = useMemo(() => {
    if (isGain) return null
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const agg = (pred: (d: string) => boolean) => {
      const list = events.filter(e => pred(e.date))
      return { n: list.length, amt: parseFloat(list.reduce((s, e) => s + (Number(e.loss_amt) || 0), 0).toFixed(2)) }
    }
    return [
      { label: 'All-Time', period: agg(() => true) },
      { label: 'Yesterday', period: agg(d => d === yesterday) },
      { label: 'This Week', period: agg(d => d >= ws) },
      { label: 'This Month', period: agg(d => d >= monthStart) },
      { label: 'This Year', period: agg(d => d >= yearStart) },
    ]
  }, [events, isGain])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const sign = isGain ? '+' : '-'
  const valueCls = isGain ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="flex flex-col h-full min-h-0">
      {periodSummary && (
        <div className="grid grid-cols-5 gap-0.5 px-2 pt-1 shrink-0">
          {periodSummary.map(r => (
            <div key={r.label} className="bg-white border border-gray-200 rounded px-1 py-0.5 text-center">
              <p className="text-[7px] text-gray-400 truncate">{r.label}</p>
              <p className={`text-[8px] font-bold ${r.period.n > 0 ? 'text-red-600' : 'text-green-600'}`}>₵{fmtN(r.period.amt)}</p>
            </div>
          ))}
        </div>
      )}
      <div className={`flex flex-col gap-1 px-2 py-1 border-b shrink-0 ${isGain ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
        <p className={`text-[8px] font-bold ${isGain ? 'text-amber-800' : 'text-red-800'}`}>
          {isGain
            ? `⚠ ${filtered.length} gain${filtered.length === 1 ? '' : 's'} on record — all should be 0; each one is a missing bill/GMC or a count error to fix`
            : `${filtered.length} loss${filtered.length === 1 ? '' : 'es'} detected`}
        </p>
        <div className="flex items-center justify-between gap-1">
          <p className={`text-[8px] font-bold ${isGain ? 'text-amber-800' : 'text-red-800'}`}>Total: ₵{fmtN(parseFloat(totalAmt.toFixed(2)))}</p>
          <ColumnsPickerButton prefs={colPrefs} />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">
            {isGain ? 'No gains on record — all clean. 🎉' : 'No losses recorded. 🎉'}
          </p>
        ) : (
          <table className="border-collapse text-[10px] w-full" style={{
            tableLayout: 'fixed',
          }}>
            <colgroup>
              <col style={{ width: colPrefs.getWidth('date', LOSS_FEED_COL_DEFAULTS.date) }} />
              <col style={{ width: colPrefs.getWidth('item', LOSS_FEED_COL_DEFAULTS.item) }} />
              {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, LOSS_FEED_COL_DEFAULTS[c.key] ?? 80) }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr className={`${isGain ? 'bg-amber-500' : 'bg-red-600'} text-white font-bold text-[9px]`}>
                <th className="relative overflow-hidden text-left px-0.5 py-0.5 border-r border-white/20">
                  <span className="block truncate">DATE</span>
                  <ColResizeHandle onResize={d => colPrefs.resizeWidth('date', d, LOSS_FEED_COL_DEFAULTS.date)} onReset={() => colPrefs.resetWidth('date')} />
                </th>
                <th className="relative overflow-hidden text-left px-0.5 py-0.5 border-r border-white/20">
                  <span className="block truncate">ITEM</span>
                  <ColResizeHandle onResize={d => colPrefs.resizeWidth('item', d, LOSS_FEED_COL_DEFAULTS.item)} onReset={() => colPrefs.resetWidth('item')} />
                </th>
                {colPrefs.shownColumns.map((c, i) => {
                  const meta = colByKey.get(c.key)!
                  return (
                    <th key={c.key} title={meta.title}
                      className={`relative overflow-hidden px-0.5 py-0.5 ${c.key === 'lossAmt' ? 'text-right px-0.5' : 'text-center'} ${i === colPrefs.shownColumns.length - 1 ? '' : 'border-r border-white/20'}`}>
                      <span className="block truncate text-[9px]">{c.label}</span>
                      <ColResizeHandle onResize={d => colPrefs.resizeWidth(c.key, d, LOSS_FEED_COL_DEFAULTS[c.key] ?? 80)} onReset={() => colPrefs.resetWidth(c.key)} />
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((e, i) => {
                const newDay = i === 0 || filtered[i - 1].date !== e.date
                return (
                  <tr key={`${e.item_id}-${e.date}`} className={`${newDay ? 'border-t-2 border-gray-300' : ''} bg-white ${isGain ? 'hover:bg-amber-50/50' : 'hover:bg-red-50/50'}`}>
                    <td className="px-0.5 py-0.5 font-bold text-gray-600 truncate text-[9px]">
                      {newDay ? fmtDate(e.date) : <span className="text-gray-300">〃</span>}
                    </td>
                    <td className="px-0.5 py-0.5 font-semibold text-gray-900 overflow-hidden text-[9px]">
                      <Link href={`/item?tab=loss&view=item360&jumpItemId=${e.item_id}`} className="block truncate text-blue-600 hover:underline">{e.item_name}</Link>
                    </td>
                    {colPrefs.shownColumns.map(c => {
                      if (c.key === 'expected') return <td key={c.key} className="px-0.5 py-0.5 text-center text-gray-500 text-[9px]">{fmtN(e.expected)}</td>
                      if (c.key === 'counted') return <td key={c.key} className="px-0.5 py-0.5 text-center text-gray-900 font-semibold text-[9px]">{fmtN(e.counted)}</td>
                      if (c.key === 'lossQty') return <td key={c.key} className={`px-0.5 py-0.5 text-center font-bold ${valueCls} text-[9px]`}>{sign}{fmtN(e.loss_qty)}</td>
                      return <td key={c.key} className={`px-0.5 py-0.5 text-right font-bold whitespace-nowrap ${valueCls} text-[9px]`}>{sign}₵{fmtN(e.loss_amt)}</td>
                    })}
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
