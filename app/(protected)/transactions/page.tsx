'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────
type TxType = 'bill' | 'sale' | 'count'
type Tab = 'All' | 'Sales' | 'Bills' | 'Counts'

type Tx = {
  type: TxType
  id: number
  date: string
  description: string | null
  total: string | null
  ref: string | null
  by: string | null
  item_count: number
}

type BillLine = { item_name: string; quantity: number; unit_price: number; item_total: number; item_id?: number }
type SaleLine = { id: number; item_name: string; quantity: number; item_price: number; item_total: number; item_id?: number }
type CountLine = { id: number; item_name: string; quantity_counted: number; notes: string | null; item_id: number | null }

type DayRow = { date: string; wic_qty: string | null; gmc_qty: string | null; bills_qty: string | null; qty_counted: string | null }
type ComputedRow = DayRow & { expected_soh: number | null; loss: number | null }

type ItemDetail = {
  id: number
  canonical_name: string
  cf_group: string | null
  selling_price: number | null
  purchase_rate: number | null
  calculated_soh: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TABS: Tab[] = ['All', 'Sales', 'Bills', 'Counts']

const TYPE_LABEL: Record<TxType, string> = { bill: 'Bill', sale: 'Sale', count: 'Count' }
const TYPE_COLOR: Record<TxType, string> = {
  bill:  'bg-orange-100 text-orange-700',
  sale:  'bg-green-100 text-green-700',
  count: 'bg-blue-100 text-blue-700',
}
const TYPE_DOT: Record<TxType, string> = {
  bill:  'bg-orange-400',
  sale:  'bg-green-400',
  count: 'bg-blue-400',
}

function fmt(n: number) { return n % 1 === 0 ? n.toString() : n.toFixed(2) }
function fmtMoney(n: number) { return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function groupByDate(txs: Tx[]) {
  const map = new Map<string, Tx[]>()
  txs.forEach(tx => {
    if (!map.has(tx.date)) map.set(tx.date, [])
    map.get(tx.date)!.push(tx)
  })
  return map
}

function numVal(v: string | null) { return v == null ? null : parseFloat(v) }

function computeLedger(rows: DayRow[]): ComputedRow[] {
  let prev: number | null = null
  return rows.map(row => {
    const bills = numVal(row.bills_qty) ?? 0
    const wic   = numVal(row.wic_qty)   ?? 0
    const gmc   = numVal(row.gmc_qty)   ?? 0
    const counted = numVal(row.qty_counted)

    let expected: number | null = null
    let loss: number | null = null

    if (prev !== null) {
      expected = parseFloat((prev + bills - wic - gmc).toFixed(4))
      if (counted !== null) { loss = parseFloat((expected - counted).toFixed(4)); prev = counted }
      else { prev = expected }
    } else if (counted !== null) {
      prev = counted
    }

    return { ...row, expected_soh: expected, loss }
  })
}

// ─── Item Ledger Panel ────────────────────────────────────────────────────────
function ItemLedger({ itemId, itemName, onClose }: { itemId: number; itemName: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ItemDetail | null>(null)
  const [rows, setRows] = useState<ComputedRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/items/${itemId}`).then(r => r.json()),
      fetch(`/api/losses/${itemId}`).then(r => r.json()),
    ]).then(([item, rawRows]) => {
      setDetail(item)
      setRows(computeLedger(rawRows))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [itemId])

  const totalLoss = rows.reduce((s, r) => r.loss != null ? s + r.loss : s, 0)

  function fmtQ(v: string | null) {
    if (v == null) return <span className="text-gray-300">—</span>
    const n = parseFloat(v)
    return <span>{fmt(n)}</span>
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" />
      {/* Panel — slides in from right */}
      <div className="w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <p className="font-bold text-gray-900 text-base leading-tight">{itemName}</p>
            {detail && <p className="text-xs text-gray-400 mt-0.5">{detail.cf_group ?? ''}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none mt-0.5">×</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <>
            {/* Item stats */}
            {detail && (
              <div className="px-4 py-3 grid grid-cols-4 gap-2 text-xs border-b border-gray-100">
                <div><p className="text-gray-400">SOH</p><p className="font-bold text-gray-900">{detail.calculated_soh ?? '—'}</p></div>
                <div><p className="text-gray-400">Sell</p><p className="font-semibold text-gray-700">{detail.selling_price ? `₵${detail.selling_price}` : '—'}</p></div>
                <div><p className="text-gray-400">Cost</p><p className="font-semibold text-gray-700">{detail.purchase_rate ? `₵${detail.purchase_rate}` : '—'}</p></div>
                <div>
                  <p className="text-gray-400">Loss</p>
                  <p className={`font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {totalLoss > 0 ? '+' : ''}{fmt(totalLoss)}
                  </p>
                </div>
              </div>
            )}

            {/* Ledger table */}
            {rows.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-12">No activity found.</p>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs min-w-[420px]">
                  <thead className="sticky top-0 bg-white border-b border-gray-200">
                    <tr className="text-gray-400">
                      <th className="text-left px-4 py-2 font-medium">Date</th>
                      <th className="text-right px-2 py-2 font-medium">Count</th>
                      <th className="text-right px-2 py-2 font-medium text-green-600">-WIC</th>
                      <th className="text-right px-2 py-2 font-medium text-green-600">-GMC</th>
                      <th className="text-right px-2 py-2 font-medium text-blue-600">+Bills</th>
                      <th className="text-right px-2 py-2 font-medium">Expt</th>
                      <th className="text-right px-4 py-2 font-medium">Loss/Gain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((row, i) => (
                      <tr key={i} className={row.loss != null && row.loss > 0.001 ? 'bg-red-50' : ''}>
                        <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{fmtDate(row.date)}</td>
                        <td className="px-2 py-2 text-right font-semibold text-gray-900">{fmtQ(row.qty_counted)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtQ(row.wic_qty)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtQ(row.gmc_qty)}</td>
                        <td className="px-2 py-2 text-right text-blue-600">{fmtQ(row.bills_qty)}</td>
                        <td className="px-2 py-2 text-right text-gray-400">
                          {row.expected_soh == null ? <span className="text-gray-300">—</span> : fmt(row.expected_soh)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {row.loss === null ? <span className="text-gray-300">—</span>
                            : row.loss > 0.001 ? <span className="text-red-600">+{fmt(row.loss)}</span>
                            : row.loss < -0.001 ? <span className="text-green-600">{fmt(row.loss)}</span>
                            : <span className="text-gray-400">0</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td colSpan={6} className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Total</td>
                      <td className={`px-4 py-2 text-right text-xs font-bold ${totalLoss > 0 ? 'text-red-600' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                        {totalLoss > 0 ? '+' : ''}{fmt(totalLoss)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Transaction Row ──────────────────────────────────────────────────────────
function TxRow({ tx, onItemTap }: { tx: Tx; onItemTap: (id: number, name: string) => void }) {
  const [open, setOpen] = useState(false)
  const [lines, setLines] = useState<(BillLine | SaleLine | CountLine)[]>([])
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!open && !lines.length) {
      setLoading(true)
      try {
        let url = ''
        if (tx.type === 'bill')  url = `/api/bills/${tx.id}`
        if (tx.type === 'sale')  url = `/api/sales/${tx.id}`
        if (tx.type === 'count') url = `/api/transactions/counts?date=${tx.date}&by=${encodeURIComponent(tx.by ?? '')}`
        const data = await fetch(url).then(r => r.json())
        setLines(Array.isArray(data) ? data : [])
      } catch {}
      setLoading(false)
    }
    setOpen(v => !v)
  }

  const total = tx.total ? Number(tx.total) : null

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Main row */}
      <button onClick={toggle} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_DOT[tx.type]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${TYPE_COLOR[tx.type]}`}>
              {TYPE_LABEL[tx.type]}
            </span>
            {tx.ref && <span className="text-[10px] text-gray-400 font-mono">{tx.ref}</span>}
          </div>
          <p className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
            {tx.description || (tx.type === 'sale' ? 'Walk-in Customer' : '—')}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {tx.item_count} item{tx.item_count !== 1 ? 's' : ''}
            {tx.by ? ` · ${tx.by}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          {total != null && (
            <p className="text-sm font-bold text-gray-900">{fmtMoney(total)}</p>
          )}
          <p className="text-gray-400 text-xs mt-0.5">{open ? '▲' : '▼'}</p>
        </div>
      </button>

      {/* Expanded lines */}
      {open && (
        <div className="border-t border-gray-100">
          {loading ? (
            <p className="text-xs text-gray-400 px-4 py-3">Loading…</p>
          ) : lines.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">No items.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {tx.type === 'bill' && (lines as BillLine[]).map((l, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-800 flex-1 min-w-0 truncate">{l.item_name}</p>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{fmt(l.quantity)} × ₵{fmt(l.unit_price)}</p>
                    <p className="text-sm font-semibold text-gray-900">₵{fmt(l.item_total)}</p>
                  </div>
                </div>
              ))}

              {tx.type === 'sale' && (lines as SaleLine[]).map((l, i) => (
                <button key={i} onClick={() => l.item_id && onItemTap(l.item_id, l.item_name)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{l.item_name}</p>
                    {l.item_id && <span className="text-[10px] text-blue-500 shrink-0">→ ledger</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-gray-500">{fmt(l.quantity)} × ₵{fmt(l.item_price)}</p>
                    <p className="text-sm font-semibold text-gray-900">₵{fmt(l.item_total)}</p>
                  </div>
                </button>
              ))}

              {tx.type === 'count' && (lines as CountLine[]).map((l, i) => (
                <button key={i} onClick={() => l.item_id && onItemTap(l.item_id, l.item_name)}
                  className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-blue-50 transition">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{l.item_name}</p>
                    {l.item_id && <span className="text-[10px] text-blue-500 shrink-0">→ ledger</span>}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 shrink-0">{fmt(l.quantity_counted)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TransactionsPage() {
  const [tab, setTab] = useState<Tab>('All')
  const [txs, setTxs] = useState<Tx[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [ledger, setLedger] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    fetch('/api/transactions')
      .then(r => r.json())
      .then(d => { setTxs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const newHref = tab === 'Bills' ? '/bills/new'
    : tab === 'Counts' ? '/stock/counts'
    : '/sales/new'

  const newLabel = tab === 'Bills' ? '+ New Bill'
    : tab === 'Counts' ? '+ New Count'
    : tab === 'Sales' ? '+ New Sale'
    : '+ New'

  const filtered = txs.filter(tx => {
    if (tab === 'Sales'  && tx.type !== 'sale')  return false
    if (tab === 'Bills'  && tx.type !== 'bill')  return false
    if (tab === 'Counts' && tx.type !== 'count') return false
    if (dateFrom && tx.date < dateFrom) return false
    if (dateTo   && tx.date > dateTo)   return false
    if (search) {
      const q = search.toLowerCase()
      return (tx.description ?? '').toLowerCase().includes(q) ||
             (tx.ref ?? '').toLowerCase().includes(q) ||
             (tx.by ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const grouped = groupByDate(filtered)
  const dates = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

  const openLedger = useCallback((id: number, name: string) => setLedger({ id, name }), [])

  return (
    <div className="py-4 max-w-2xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-gray-900">Transactions</h1>
        <Link href={tab === 'All' ? '/sales/new' : newHref}
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          {tab === 'All' ? (
            <span className="flex items-center gap-1.5">
              <span>+ New</span>
              <span className="text-blue-200 text-xs">▾</span>
            </span>
          ) : newLabel}
        </Link>
      </div>

      {/* Tab filter */}
      <div className="overflow-x-auto -mx-4 px-4">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 min-w-max">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* "+ New" sub-options when on All tab */}
      {tab === 'All' && (
        <div className="flex gap-2">
          <Link href="/sales/new" className="flex-1 text-center text-xs font-semibold py-2 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 transition">
            + Sale
          </Link>
          <Link href="/bills/new" className="flex-1 text-center text-xs font-semibold py-2 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition">
            + Bill
          </Link>
          <Link href="/stock/counts" className="flex-1 text-center text-xs font-semibold py-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
            + Count
          </Link>
        </div>
      )}

      {/* Search + date filters */}
      <div className="space-y-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendor, customer, staff…"
          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-400" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {(search || dateFrom || dateTo) && (
          <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-blue-600 font-semibold">
            Clear filters
          </button>
        )}
      </div>

      {/* Feed */}
      {loading ? (
        <p className="text-center text-gray-400 py-16 text-sm">Loading…</p>
      ) : dates.length === 0 ? (
        <p className="text-center text-gray-400 py-16 text-sm">No transactions found.</p>
      ) : (
        <div className="space-y-6">
          {dates.map(date => (
            <div key={date}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">
                {fmtDate(date)}
              </p>
              <div className="space-y-2">
                {grouped.get(date)!.map((tx, i) => (
                  <TxRow key={`${tx.type}-${tx.id}-${i}`} tx={tx} onItemTap={openLedger} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item Ledger slide-in */}
      {ledger && (
        <ItemLedger itemId={ledger.id} itemName={ledger.name} onClose={() => setLedger(null)} />
      )}
    </div>
  )
}
