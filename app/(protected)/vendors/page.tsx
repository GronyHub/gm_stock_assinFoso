'use client'
import { useState, useEffect, useMemo } from 'react'

type Vendor = {
  id: number
  display_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  status: string | null
  payment_terms_label: string | null
  is_internal: boolean
  notes: string | null
  bill_count: number
  bill_total: string
  outstanding: string
  payment_count: number
  amount_paid: string
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'external' | 'internal' | 'outstanding'>('all')
  const [selected, setSelected] = useState<Vendor | null>(null)

  useEffect(() => {
    fetch('/api/vendors')
      .then(r => r.json())
      .then(d => { setVendors(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let v = vendors
    if (filter === 'external')    v = v.filter(x => !x.is_internal)
    if (filter === 'internal')    v = v.filter(x =>  x.is_internal)
    if (filter === 'outstanding') v = v.filter(x => parseFloat(x.outstanding) > 0)
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(x =>
        (x.display_name ?? '').toLowerCase().includes(q) ||
        (x.company_name ?? '').toLowerCase().includes(q) ||
        (x.phone ?? '').toLowerCase().includes(q)
      )
    }
    return v
  }, [vendors, filter, search])

  const totals = useMemo(() => ({
    bills:       vendors.reduce((s, v) => s + v.bill_count, 0),
    billed:      vendors.reduce((s, v) => s + parseFloat(v.bill_total), 0),
    paid:        vendors.reduce((s, v) => s + parseFloat(v.amount_paid), 0),
    outstanding: vendors.reduce((s, v) => s + parseFloat(v.outstanding), 0),
  }), [vendors])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Vendors</h1>
        <span className="text-xs text-gray-400">{vendors.length} vendors</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Billed',  value: c(String(totals.billed)),      color: 'text-gray-900' },
          { label: 'Amount Paid',   value: c(String(totals.paid)),         color: 'text-green-700' },
          { label: 'Outstanding',   value: c(String(totals.outstanding)),  color: totals.outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Total Bills',   value: String(totals.bills),           color: 'text-blue-700' },
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
          placeholder="Search vendors…"
          className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all','external','internal','outstanding'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected vendor detail */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900">{selected.display_name}</p>
              {selected.company_name && selected.company_name !== selected.display_name &&
                <p className="text-xs text-gray-400">{selected.company_name}</p>}
              {selected.is_internal &&
                <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Internal</span>}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-3">
            <div><span className="text-gray-400">Phone: </span><span className="font-medium">{selected.phone ?? '—'}</span></div>
            <div><span className="text-gray-400">Email: </span><span className="font-medium">{selected.email ?? '—'}</span></div>
            <div><span className="text-gray-400">Terms: </span><span className="font-medium">{selected.payment_terms_label ?? '—'}</span></div>
            <div><span className="text-gray-400">Status: </span><span className="font-medium">{selected.status ?? '—'}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            {[
              { label: 'Bills',       value: String(selected.bill_count),      sub: 'total bills' },
              { label: 'Billed',      value: c(selected.bill_total),            sub: 'total amount' },
              { label: 'Paid',        value: c(selected.amount_paid),           sub: `${selected.payment_count} payment(s)` },
              { label: 'Outstanding', value: c(selected.outstanding),           sub: parseFloat(selected.outstanding) > 0 ? '⚠ unpaid' : 'settled' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className={`text-sm font-bold ${s.label === 'Outstanding' && parseFloat(selected.outstanding) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</p>
                <p className="text-[9px] text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>

          {selected.notes && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-400">Notes</p>
              <p className="text-xs text-gray-700 mt-0.5">{selected.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Vendor list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-gray-400 text-sm">No vendors found.</p>
        )}
        {filtered.map(v => {
          const outstanding = parseFloat(v.outstanding)
          const billed      = parseFloat(v.bill_total)
          return (
            <button key={v.id} onClick={() => setSelected(v === selected ? null : v)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${selected?.id === v.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {v.is_internal && (
                    <span className="shrink-0 text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full">INT</span>
                  )}
                  <p className="text-sm font-semibold text-gray-900 truncate">{v.display_name}</p>
                </div>
                <div className="shrink-0 text-right">
                  {billed > 0
                    ? <p className="text-sm font-bold text-gray-900">{c(v.bill_total)}</p>
                    : <p className="text-xs text-gray-400">No bills</p>}
                  {outstanding > 0 &&
                    <p className="text-[10px] font-semibold text-red-500">↑ {c(v.outstanding)} due</p>}
                </div>
              </div>
              {v.bill_count > 0 && (
                <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                  <span>{v.bill_count} bill{v.bill_count !== 1 ? 's' : ''}</span>
                  <span>{v.payment_count} payment{v.payment_count !== 1 ? 's' : ''}</span>
                  <span className="text-green-600 font-medium">{c(v.amount_paid)} paid</span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
