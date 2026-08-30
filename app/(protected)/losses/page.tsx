'use client'
import { useState, useEffect, useMemo } from 'react'

type Item = {
  item_id: number
  item_name: string
  cf_group: string | null
  calculated_soh: string | null
}

type DayRow = {
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
}

type ComputedRow = DayRow & {
  expected_soh: number | null
  loss: number | null
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' })
}

function num(val: string | null): number {
  if (!val) return 0
  return parseFloat(val) || 0
}

function computeRows(rows: DayRow[]): ComputedRow[] {
  const result: ComputedRow[] = []
  let prevExpected: number | null = null

  for (const row of rows) {
    const bills   = num(row.bills_qty)
    const wic     = num(row.wic_qty)
    const gmc     = num(row.gmc_qty)
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null

    let expected: number | null = null
    let loss: number | null = null

    if (prevExpected === null) {
      // Use first count as baseline
      if (counted !== null) {
        prevExpected = counted
        expected = counted
      }
    } else {
      expected = parseFloat((prevExpected + bills - wic - gmc).toFixed(4))
      if (counted !== null) {
        loss = parseFloat((expected - counted).toFixed(4))
        prevExpected = counted
      } else {
        prevExpected = expected
      }
    }

    result.push({ ...row, expected_soh: expected, loss })
  }

  return result
}

function fmtQ(val: string | null) {
  if (!val) return <span className="text-gray-300">—</span>
  const n = parseFloat(val)
  return <>{n % 1 === 0 ? n : n.toFixed(2)}</>
}

function fmtN(val: number | null) {
  if (val === null) return <span className="text-gray-300">—</span>
  return <>{val % 1 === 0 ? val : val.toFixed(2)}</>
}

export default function LossesPage() {
  const [items, setItems] = useState<Item[]>([])
  const [itemsLoading, setItemsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Item | null>(null)
  const [rows, setRows] = useState<ComputedRow[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  useEffect(() => {
    fetch('/api/losses/items')
      .then(r => r.json())
      .then(data => { setItems(data); setItemsLoading(false) })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return items
    return items.filter(i =>
      i.item_name.toLowerCase().includes(q) ||
      (i.cf_group ?? '').toLowerCase().includes(q)
    )
  }, [items, search])

  async function selectItem(item: Item) {
    setSelected(item)
    setRows([])
    setRowsLoading(true)
    const res = await fetch(`/api/losses/${item.item_id}`)
    const data: DayRow[] = await res.json()
    setRows(computeRows(data))
    setRowsLoading(false)
  }

  const totalLoss = useMemo(() =>
    parseFloat(rows.reduce((sum, r) => sum + (r.loss ?? 0), 0).toFixed(4)), [rows])

  if (itemsLoading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Losses</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} items</p>
        </div>
      </div>

      <input
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search item or group..."
        className="w-full mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base
          text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400"
      />

      <div className="md:flex md:gap-4 md:h-[calc(100vh-200px)]">

        {/* Left: item list */}
        <div className={`md:w-2/5 md:overflow-y-auto space-y-1.5 ${selected ? 'hidden md:block' : 'block'}`}>
          {filtered.map(item => (
            <button key={item.item_id} onClick={() => selectItem(item)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition
                ${selected?.item_id === item.item_id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.item_name}</p>
                  {item.cf_group && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.cf_group}</p>
                  )}
                </div>
                <p className="text-xs text-gray-500 shrink-0">
                  SOH: {item.calculated_soh ? parseFloat(item.calculated_soh) : '—'}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Right: detail */}
        {selected && (
          <div className="md:flex-1 md:overflow-y-auto">
            <button onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-1 text-blue-600 text-sm font-medium mb-3">
              &larr; Back
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-base font-bold text-gray-900">{selected.item_name}</p>
                  {selected.cf_group && (
                    <p className="text-xs text-gray-400">{selected.cf_group}</p>
                  )}
                </div>
                {rows.length > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-400">Cumulative Loss</p>
                    <p className={`text-lg font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-500'}`}>
                      {totalLoss > 0 ? '+' : ''}{totalLoss % 1 === 0 ? totalLoss : totalLoss.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {rowsLoading ? (
                <p className="text-center text-gray-400 py-10">Loading...</p>
              ) : rows.length === 0 ? (
                <p className="text-center text-gray-400 py-10">No activity found for this item.</p>
              ) : (
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-[11px] min-w-[580px]">
                    <thead>
                      <tr className="text-left text-gray-400 border-b border-gray-100 text-[10px]">
                        <th className="pb-0.5 font-medium pr-3">Date</th>
                        <th className="pb-0.5 font-medium text-right pr-3">Count</th>
                        <th className="pb-0.5 font-medium text-right pr-3">WIC Sales</th>
                        <th className="pb-0.5 font-medium text-right pr-3">GMC Sales</th>
                        <th className="pb-0.5 font-medium text-right pr-3">Bills In</th>
                        <th className="pb-0.5 font-medium text-right pr-3">Expected</th>
                        <th className="pb-0.5 font-medium text-right">Loss / Gain</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((row, i) => (
                        <tr key={i} className={`text-[11px] font-bold leading-tight ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50' : ''}`}>
                          <td className="py-0 pr-3 text-gray-600 whitespace-nowrap">{fmtDate(row.date)}</td>
                          <td className="py-0 pr-3 text-right font-semibold text-gray-900">{fmtQ(row.qty_counted)}</td>
                          <td className="py-0 pr-3 text-right text-gray-600">{fmtQ(row.wic_qty)}</td>
                          <td className="py-0 pr-3 text-right text-gray-600">{fmtQ(row.gmc_qty)}</td>
                          <td className="py-0 pr-3 text-right text-blue-600">{fmtQ(row.bills_qty)}</td>
                          <td className="py-0 pr-3 text-right text-gray-400">{fmtN(row.expected_soh)}</td>
                          <td className="py-0 text-right font-semibold">
                            {row.loss === null ? (
                              <span className="text-gray-300">—</span>
                            ) : row.loss > 0.001 ? (
                              <span className="text-red-600">+{row.loss % 1 === 0 ? row.loss : row.loss.toFixed(2)}</span>
                            ) : row.loss < -0.001 ? (
                              <span className="text-green-600">{row.loss % 1 === 0 ? row.loss : row.loss.toFixed(2)}</span>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td colSpan={6} className="pt-3 text-right text-xs font-semibold text-gray-500 pr-3">
                          Total Loss / Gain
                        </td>
                        <td className={`pt-3 text-right text-sm font-bold
                          ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                          {totalLoss > 0 ? '+' : ''}{totalLoss % 1 === 0 ? totalLoss : totalLoss.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
