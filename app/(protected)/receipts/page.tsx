'use client'
import { useState, useEffect, useMemo } from 'react'

type Line = {
  id: number
  item: string
  qty: number
  price: string
  total: string
  unit: string | null
  dimensions: string | null
}

type Receipt = {
  id: number
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: string | null
  customer_name: string
  customer_display: string | null
  currency_code: string
  subtotal: string
  total: string
  balance: string
  adjustment: string | null
  notes: string | null
  lines: Line[]
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE: Record<string, string> = {
  Closed:   'bg-green-100 text-green-700',
  Draft:    'bg-gray-100 text-gray-500',
  Overdue:  'bg-red-100 text-red-600',
  Sent:     'bg-blue-100 text-blue-600',
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<'all' | 'closed' | 'draft' | 'overdue'>('all')
  const [selected, setSelected] = useState<Receipt | null>(null)

  useEffect(() => {
    fetch('/api/receipts')
      .then(r => r.json())
      .then(d => { setReceipts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let v = receipts
    if (filter === 'closed')  v = v.filter(x => x.status === 'Closed')
    if (filter === 'draft')   v = v.filter(x => x.status === 'Draft')
    if (filter === 'overdue') v = v.filter(x => x.status === 'Overdue')
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(x =>
        x.invoice_number.toLowerCase().includes(q) ||
        x.customer_name.toLowerCase().includes(q) ||
        (x.customer_display ?? '').toLowerCase().includes(q)
      )
    }
    return v
  }, [receipts, filter, search])

  const totals = useMemo(() => ({
    count:   receipts.length,
    total:   receipts.reduce((s, x) => s + parseFloat(x.total), 0),
    balance: receipts.reduce((s, x) => s + parseFloat(x.balance), 0),
    closed:  receipts.filter(x => x.status === 'Closed').length,
  }), [receipts])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Receipts</h1>
        <span className="text-xs text-gray-400">{receipts.length} receipts</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Value',  value: c(String(totals.total)),   color: 'text-gray-900' },
          { label: 'Paid / Closed', value: String(totals.closed),    color: 'text-green-700' },
          { label: 'Outstanding',  value: c(String(totals.balance)), color: totals.balance > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Total',        value: String(totals.count),      color: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="space-y-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by receipt number or customer…"
          className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'closed', 'draft', 'overdue'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected receipt detail */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900">{selected.invoice_number}</p>
              <p className="text-sm text-gray-600">{selected.customer_display ?? selected.customer_name}</p>
              <div className="flex gap-1.5 mt-1 items-center">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[selected.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                  {selected.status ?? 'Unknown'}
                </span>
                <span className="text-[10px] text-gray-400">{fmtDate(selected.invoice_date)}</span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400">Subtotal</p>
              <p className="text-sm font-bold text-gray-900">{c(selected.subtotal)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-900">{c(selected.total)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400">Balance</p>
              <p className={`text-sm font-bold ${parseFloat(selected.balance) > 0 ? 'text-red-600' : 'text-green-700'}`}>{c(selected.balance)}</p>
            </div>
          </div>

          {/* Line items */}
          {selected.lines.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Items</p>
              {selected.lines.map(l => (
                <div key={l.id} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{l.item}</p>
                    <p className="text-gray-400">
                      {l.qty} {l.unit ?? 'unit'}{Number(l.qty) !== 1 ? 's' : ''}
                      {l.dimensions ? ` · ${l.dimensions}` : ''}
                      {' @ '}{c(l.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">{c(l.total)}</p>
                </div>
              ))}
            </div>
          )}

          {selected.notes && selected.notes !== 'Thanks for your business.' && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-400">Notes</p>
              <p className="text-xs text-gray-700 mt-0.5">{selected.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Receipt list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-gray-400 text-sm">No receipts found.</p>
        )}
        {filtered.map(r => {
          const balance = parseFloat(r.balance)
          return (
            <button key={r.id} onClick={() => setSelected(r === selected ? null : r)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${selected?.id === r.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-gray-900">{r.invoice_number}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${STATUS_STYLE[r.status ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{r.customer_display ?? r.customer_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-gray-900">{c(r.total)}</p>
                  {balance > 0 && <p className="text-[10px] text-red-500 font-semibold">↑ {c(r.balance)} due</p>}
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">{fmtDate(r.invoice_date)} · {r.lines.length} item{r.lines.length !== 1 ? 's' : ''}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
