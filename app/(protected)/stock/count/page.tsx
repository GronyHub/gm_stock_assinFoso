'use client'
import { useState, useEffect } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Item = {
  item_id: number
  item_name: string
  cf_group: string | null
  calculated_soh: number
  last_count_date: string | null
  days_overdue: number | null
}

type Flags = {
  noCash: any[]
  missingDays: any[]
  duplicates: any[]
  costGteSell: any[]
  notInInventory: any[]
  noGroup: any[]
  noStaffTimes: any[]
}

const ALL_TABS = ['Daily', '15-Day', 'No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group'] as const
type Tab = typeof ALL_TABS[number]

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n}</span>
}

function CountCard({ item, onSaved }: { item: Item; onSaved: (id: number) => void }) {
  const [customQty, setCustomQty] = useState('')
  const [saving, setSaving] = useState(false)
  const soh = Number(item.calculated_soh)

  async function submit(qty: number) {
    setSaving(true)
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id, qty, notes: '' }),
    })
    setSaving(false)
    if (res.ok) onSaved(item.item_id)
  }

  const overdue = item.days_overdue
  const badgeClass = overdue === null || overdue === 0 ? 'bg-orange-100 text-orange-600'
    : overdue <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const badgeLabel = overdue === null ? 'Never counted' : overdue === 0 ? 'Not today' : `${overdue}d overdue`

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-gray-900 font-medium leading-snug">{item.item_name}</p>
          {item.cf_group && <p className="text-gray-400 text-xs mt-0.5">{item.cf_group}</p>}
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${badgeClass}`}>{badgeLabel}</span>
      </div>
      <p className="text-sm text-gray-600">Stock on hand: <span className="text-gray-900 font-semibold text-base">{soh}</span></p>
      <div className="flex items-center gap-2">
        <button onClick={() => submit(soh)} disabled={saving}
          className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
          {saving ? 'Saving…' : `Same (${soh})`}
        </button>
        <input type="number" min="0" step="any" value={customQty} onChange={e => setCustomQty(e.target.value)}
          placeholder="New qty" inputMode="decimal"
          className="w-24 bg-gray-100 border border-gray-300 rounded-xl px-2 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400 text-center" />
        <button onClick={() => { if (customQty !== '') submit(Number(customQty)) }}
          disabled={customQty === '' || saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-sm font-semibold rounded-xl px-4 py-3 transition">
          Save
        </button>
      </div>
    </div>
  )
}

function FlagTable({ headers, rows, empty }: { headers: string[]; rows: (string | number | null)[][]; empty: string }) {
  if (!rows.length) return <p className="py-10 text-center text-gray-400 text-sm">{empty}</p>
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>{headers.map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-800">{cell ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function StockCountPage() {
  const [tab, setTab] = useState<Tab>('Daily')
  const [dailyItems, setDailyItems] = useState<Item[]>([])
  const [overdueItems, setOverdueItems] = useState<Item[]>([])
  const [flags, setFlags] = useState<Flags | null>(null)
  const [loading, setLoading] = useState(true)
  const [flagsLoading, setFlagsLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, overdue]) => {
      setDailyItems(daily); setOverdueItems(overdue); setLoading(false)
    })
  }, [])

  useEffect(() => {
    const flagTabs: Tab[] = ['No Cash', 'Missing Days', 'No Times', 'Duplicates', 'Cost≥Price', 'Not in Inv.', 'No Group']
    if (flagTabs.includes(tab) && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => {
          setFlags({ noCash: [], missingDays: [], duplicates: [], costGteSell: [], notInInventory: [], noGroup: [], noStaffTimes: [] })
          setFlagsLoading(false)
        })
    }
  }, [tab, flags, flagsLoading])

  function removeDaily(id: number) { setDailyItems(prev => prev.filter(i => i.item_id !== id)) }
  function removeOverdue(id: number) { setOverdueItems(prev => prev.filter(i => i.item_id !== id)) }

  if (loading) return <div className="py-20 text-center text-gray-600">Loading…</div>

  const countItems = tab === 'Daily' ? dailyItems : overdueItems

  function renderFlags() {
    if (flagsLoading || !flags) return <div className="py-10 text-center text-gray-400">Loading…</div>
    if (tab === 'No Cash') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noCash.length} walk-in receipt{flags.noCash.length !== 1 ? 's' : ''} missing cash counted</p>
        <FlagTable
          headers={['Receipt No.', 'Date', 'Invoice']}
          rows={flags.noCash.map(r => [r.receipt_number, fmtDate(r.receipt_date), `₵${Number(r.invoice_amount).toFixed(2)}`])}
          empty="All walk-in receipts have cash counted recorded."
        />
      </div>
    )
    if (tab === 'Missing Days') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.missingDays.length} day{flags.missingDays.length !== 1 ? 's' : ''} with no sales receipts (excluding Sundays)</p>
        <FlagTable
          headers={['Date']}
          rows={flags.missingDays.map(r => [fmtDate(r.missing_date)])}
          empty="No missing days found."
        />
      </div>
    )
    if (tab === 'No Times') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noStaffTimes.length} day{flags.noStaffTimes.length !== 1 ? 's' : ''} with no staff times recorded (excluding Sundays)</p>
        <FlagTable
          headers={['Date']}
          rows={flags.noStaffTimes.map(r => [fmtDate(r.missing_date)])}
          empty="All working days have staff times recorded."
        />
      </div>
    )
    if (tab === 'Duplicates') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.duplicates.length} possible duplicate pair{flags.duplicates.length !== 1 ? 's' : ''} (similarity &gt; 70%)</p>
        <FlagTable
          headers={['Item 1', 'Item 2']}
          rows={flags.duplicates.map(r => [r.name1, r.name2])}
          empty="No duplicate or similar item names found."
        />
      </div>
    )
    if (tab === 'Cost≥Price') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.costGteSell.length} line{flags.costGteSell.length !== 1 ? 's' : ''} where cost price ≥ selling price</p>
        <FlagTable
          headers={['Receipt', 'Date', 'Item', 'Sold At', 'Cost']}
          rows={flags.costGteSell.map(r => [
            r.receipt_number, fmtDate(r.receipt_date), r.item_name,
            `₵${Number(r.selling_price).toFixed(2)}`, `₵${Number(r.cost_price).toFixed(2)}`,
          ])}
          empty="No items sold at or below cost price."
        />
      </div>
    )
    if (tab === 'Not in Inv.') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.notInInventory.length} item name{flags.notInInventory.length !== 1 ? 's' : ''} not found in inventory</p>
        <FlagTable
          headers={['Item Name', 'Source']}
          rows={flags.notInInventory.map(r => [r.item_name, r.source])}
          empty="All items in receipts and counts are in inventory."
        />
      </div>
    )
    if (tab === 'No Group') return (
      <div className="space-y-2">
        <p className="text-xs text-gray-400">{flags.noGroup.length} item{flags.noGroup.length !== 1 ? 's' : ''} with no group assigned</p>
        <FlagTable
          headers={['Item Name', 'Status']}
          rows={flags.noGroup.map(r => [r.item_name, r.status])}
          empty="All items have a group assigned."
        />
      </div>
    )
    return null
  }

  const flagCounts: Partial<Record<Tab, number>> = flags ? {
    'No Cash': flags.noCash.length,
    'Missing Days': flags.missingDays.length,
    'No Times': flags.noStaffTimes.length,
    'Duplicates': flags.duplicates.length,
    'Cost≥Price': flags.costGteSell.length,
    'Not in Inv.': flags.notInInventory.length,
    'No Group': flags.noGroup.length,
  } : {}

  const isCountTab = tab === 'Daily' || tab === '15-Day'

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Stock Count & Flags</h1>
        <p className="text-sm text-gray-400 mt-0.5">{dailyItems.length + overdueItems.length} count{dailyItems.length + overdueItems.length !== 1 ? 's' : ''} pending</p>
      </div>

      {/* Tabs — scrollable on mobile */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 min-w-max">
          {ALL_TABS.map(t => {
            const cnt = t === 'Daily' ? dailyItems.length : t === '15-Day' ? overdueItems.length : (flagCounts[t] ?? 0)
            return (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition
                  ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {t}<Badge n={cnt} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {isCountTab ? (
        countItems.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">{tab === 'Daily' ? 'All daily items counted!' : 'All items up to date!'}</p>
        ) : (
          <div className="space-y-3">
            {countItems.map(item => (
              <CountCard key={item.item_id} item={item} onSaved={tab === 'Daily' ? removeDaily : removeOverdue} />
            ))}
          </div>
        )
      ) : renderFlags()}
    </div>
  )
}
