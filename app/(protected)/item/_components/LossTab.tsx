'use client'
import { useState, useEffect, useMemo } from 'react'

type Item = {
  item_id: number
  item_name: string
  cf_group: string | null
  calculated_soh: string | null
  selling_rate: string | null
  purchase_rate: string | null
}

type DayRow = {
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
}

type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

function n(v: string | null) { return parseFloat(v ?? '0') || 0 }

function computeRows(rows: DayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prev: number | null = null
  for (const row of rows) {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    let expected: number | null = null
    let loss: number | null = null
    if (prev === null) {
      if (counted !== null) { prev = counted; expected = counted }
    } else {
      expected = parseFloat((prev + n(row.bills_qty) - n(row.wic_qty) - n(row.gmc_qty)).toFixed(4))
      if (counted !== null) { loss = parseFloat((expected - counted).toFixed(4)); prev = counted }
      else { prev = expected }
    }
    result.push({ ...row, expected_soh: expected, loss })
  }
  return result
}

function fmtCcy(v: string | null) {
  if (!v) return '—'
  const x = parseFloat(v)
  return isNaN(x) ? '—' : `₵${x.toFixed(2)}`
}

function fmtQ(v: number) {
  return v % 1 === 0 ? String(v) : v.toFixed(4).replace(/\.?0+$/, '')
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className={`rounded-xl p-3 ${color ?? 'bg-gray-50'}`}>
      <p className="text-[10px] text-gray-400 font-medium">{label}</p>
      <p className="text-base font-bold text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  )
}

export default function LossTab({ onOpenItem }: { onOpenItem: (itemId: number) => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Item | null>(null)
  const [rows, setRows] = useState<ComputedRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/losses/items').then(r => r.json())
      .then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return !q ? items : items.filter(i =>
      i.item_name.toLowerCase().includes(q) ||
      (i.cf_group ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  async function selectItem(item: Item) {
    setSelected(item)
    setRows([])
    setRowsLoading(true)
    const data: DayRow[] = await fetch(`/api/losses/${item.item_id}`).then(r => r.json())
    setRows(computeRows(data))
    setRowsLoading(false)
  }

  const sp = parseFloat(selected?.selling_rate ?? '0') || 0
  const cp = parseFloat(selected?.purchase_rate ?? '0') || 0
  const soh = parseFloat(selected?.calculated_soh ?? '0') || 0

  const totals = useMemo(() => {
    let lgQty = 0, cnt = 0, wic = 0, gmc = 0, bl = 0
    for (const r of rows) {
      if (r.loss !== null) lgQty += r.loss
      if (r.qty_counted !== null) cnt += n(r.qty_counted)
      wic += n(r.wic_qty); gmc += n(r.gmc_qty); bl += n(r.bills_qty)
    }
    lgQty = parseFloat(lgQty.toFixed(4))
    return { lgQty, lgAmt: parseFloat((lgQty * sp).toFixed(2)), cnt: parseFloat(cnt.toFixed(4)), wic: parseFloat(wic.toFixed(4)), gmc: parseFloat(gmc.toFixed(4)), bl: parseFloat(bl.toFixed(4)) }
  }, [rows, sp])

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  const lossColor = (v: number) => v > 0 ? 'text-red-600' : v < 0 ? 'text-green-600' : 'text-gray-400'
  const lossBg = (v: number) => v > 0 ? 'bg-red-50' : v < 0 ? 'bg-green-50' : 'bg-gray-50'

  return (
    <div className="flex gap-3 h-full min-h-0">

      {/* Left pane — item list */}
      <div className="w-2/5 flex flex-col min-h-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search item or group…"
          className="mb-2 shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm
            text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
          {filtered.map(item => (
            <button key={item.item_id} onClick={() => selectItem(item)}
              className={`w-full text-left rounded-xl border px-3 py-2 transition
                ${selected?.item_id === item.item_id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <p className="text-xs font-semibold text-gray-900 truncate">{item.item_name}</p>
              {item.cf_group && <p className="text-[10px] text-gray-400 mt-0.5">{item.cf_group}</p>}
            </button>
          ))}
        </div>
      </div>

      {/* Right pane — totals */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            Select an item to view totals
          </div>
        ) : rowsLoading ? (
          <div className="py-20 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">

            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900 text-sm">{selected.item_name}</p>
                {selected.cf_group && <p className="text-xs text-gray-400 mt-0.5">{selected.cf_group}</p>}
              </div>
              <button onClick={() => onOpenItem(selected.item_id)}
                className="shrink-0 text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition whitespace-nowrap">
                Open in Items →
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              {/* ₵ L/G */}
              <div className={`rounded-xl p-3 col-span-1 ${lossBg(totals.lgAmt)}`}>
                <p className="text-[10px] text-gray-400 font-medium">₵ L/G</p>
                <p className={`text-base font-bold mt-0.5 ${lossColor(totals.lgAmt)}`}>
                  {totals.lgAmt > 0 ? '+' : ''}₵{Math.abs(totals.lgAmt).toFixed(2)}
                </p>
              </div>
              {/* L/G qty */}
              <div className={`rounded-xl p-3 ${lossBg(totals.lgQty)}`}>
                <p className="text-[10px] text-gray-400 font-medium">L/G</p>
                <p className={`text-base font-bold mt-0.5 ${lossColor(totals.lgQty)}`}>
                  {totals.lgQty > 0 ? '+' : ''}{fmtQ(totals.lgQty)}
                </p>
              </div>
              {/* CNT */}
              <StatCard label="CNT" value={fmtQ(totals.cnt)} />
              {/* WIC */}
              <StatCard label="WIC" value={fmtQ(totals.wic)} />
              {/* GMC */}
              <StatCard label="GMC" value={fmtQ(totals.gmc)} />
              {/* BL */}
              <div className="rounded-xl p-3 bg-blue-50">
                <p className="text-[10px] text-blue-400 font-medium">BL</p>
                <p className="text-base font-bold text-blue-700 mt-0.5">{fmtQ(totals.bl)}</p>
              </div>
              {/* SOH */}
              <div className={`rounded-xl p-3 ${soh <= 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                <p className="text-[10px] text-gray-400 font-medium">SOH</p>
                <p className={`text-base font-bold mt-0.5 ${soh <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {soh % 1 === 0 ? soh : soh.toFixed(2)}
                </p>
              </div>
              {/* SP */}
              <div className="rounded-xl p-3 bg-gray-50">
                <p className="text-[10px] text-gray-400 font-medium">SP</p>
                <p className="text-base font-bold text-blue-600 mt-0.5">{fmtCcy(selected.selling_rate)}</p>
              </div>
              {/* CP */}
              <div className="rounded-xl p-3 bg-gray-50">
                <p className="text-[10px] text-gray-400 font-medium">CP</p>
                <p className="text-base font-bold text-green-600 mt-0.5">{fmtCcy(selected.purchase_rate)}</p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
