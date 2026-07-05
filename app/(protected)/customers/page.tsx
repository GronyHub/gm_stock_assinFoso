'use client'
import { useState, useEffect, useMemo } from 'react'

type Customer = {
  id: number
  display_name: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  status: string | null
  payment_terms_label: string | null
  opening_balance: string | null
  credit_limit: string | null
  notes: string | null
  is_internal: boolean
  receipt_count: number
  receipt_total: string
  receipt_balance: string
  invoice_count: number
  invoice_total: string
  invoice_outstanding: string
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

function NewCustomerForm({ onCreated, onCancel }: { onCreated: (c: Customer) => void; onCancel: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!displayName.trim()) { setError('Customer name is required.'); return }

    setSaving(true)
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onCreated(await res.json())
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Could not save customer.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">New Customer</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
      </div>

      <div>
        <label className={labelCls}>Customer Name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Kwame Mensah" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Company (optional)</label>
        <input value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : 'Save Customer'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
      </div>
    </div>
  )
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'internal'>('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let v = customers
    if (filter === 'active')   v = v.filter(x => x.status === 'Active')
    if (filter === 'inactive') v = v.filter(x => x.status !== 'Active')
    if (filter === 'internal') v = v.filter(x => x.is_internal)
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(x =>
        (x.display_name ?? '').toLowerCase().includes(q) ||
        (x.company_name ?? '').toLowerCase().includes(q) ||
        (x.email ?? '').toLowerCase().includes(q) ||
        (x.phone ?? '').toLowerCase().includes(q)
      )
    }
    return v
  }, [customers, filter, search])

  const totals = useMemo(() => ({
    customers:   customers.length,
    receipts:    customers.reduce((s, x) => s + x.receipt_count, 0),
    sales:       customers.reduce((s, x) => s + parseFloat(x.receipt_total), 0),
    outstanding: customers.reduce((s, x) => s + parseFloat(x.invoice_outstanding), 0),
  }), [customers])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{customers.length} contacts</span>
          <button onClick={() => setShowForm(f => !f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition
              ${showForm ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {showForm ? '×' : '+ New Customer'}
          </button>
        </div>
      </div>

      {showForm && (
        <NewCustomerForm
          onCancel={() => setShowForm(false)}
          onCreated={created => { setCustomers(prev => [created, ...prev]); setShowForm(false) }}
        />
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Total Sales',    value: c(String(totals.sales)),       color: 'text-gray-900' },
          { label: 'Receipts',       value: String(totals.receipts),       color: 'text-blue-700' },
          { label: 'Outstanding',    value: c(String(totals.outstanding)), color: totals.outstanding > 0 ? 'text-red-600' : 'text-gray-400' },
          { label: 'Customers',      value: String(totals.customers),      color: 'text-purple-700' },
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
          placeholder="Search customers…"
          className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {(['all', 'active', 'inactive', 'internal'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition
                ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Selected customer detail */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-bold text-gray-900">{selected.display_name}</p>
              {selected.company_name && selected.company_name !== selected.display_name &&
                <p className="text-xs text-gray-400">{selected.company_name}</p>}
              <div className="flex gap-1.5 mt-1">
                {selected.is_internal &&
                  <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded-full">Internal</span>}
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                  ${selected.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selected.status ?? 'Unknown'}
                </span>
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-3">
            <div><span className="text-gray-400">Phone: </span><span className="font-medium">{selected.phone ?? '—'}</span></div>
            <div><span className="text-gray-400">Email: </span><span className="font-medium">{selected.email ?? '—'}</span></div>
            <div><span className="text-gray-400">Terms: </span><span className="font-medium">{selected.payment_terms_label ?? '—'}</span></div>
            <div><span className="text-gray-400">Credit: </span><span className="font-medium">{c(selected.credit_limit)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            {[
              { label: 'Receipts',     value: String(selected.receipt_count),    sub: c(selected.receipt_total) + ' sales' },
              { label: 'Invoices',     value: String(selected.invoice_count),    sub: c(selected.invoice_total) + ' invoiced' },
              { label: 'Inv. Balance', value: c(selected.invoice_outstanding),   sub: parseFloat(selected.invoice_outstanding) > 0 ? '⚠ unpaid' : 'settled' },
              { label: 'Opening Bal', value: c(selected.opening_balance),        sub: 'opening balance' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-gray-400">{s.label}</p>
                <p className={`text-sm font-bold ${s.label === 'Inv. Balance' && parseFloat(selected.invoice_outstanding) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{s.value}</p>
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

      {/* Customer list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-gray-400 text-sm">No customers found.</p>
        )}
        {filtered.map(v => {
          const sales = parseFloat(v.receipt_total)
          const outstanding = parseFloat(v.invoice_outstanding)
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
                  {sales > 0
                    ? <p className="text-sm font-bold text-gray-900">{c(v.receipt_total)}</p>
                    : <p className="text-xs text-gray-400">No sales</p>}
                  {outstanding > 0 &&
                    <p className="text-[10px] font-semibold text-red-500">↑ {c(v.invoice_outstanding)} due</p>}
                </div>
              </div>
              {v.receipt_count > 0 && (
                <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
                  <span>{v.receipt_count} receipt{v.receipt_count !== 1 ? 's' : ''}</span>
                  {v.invoice_count > 0 && <span>{v.invoice_count} invoice{v.invoice_count !== 1 ? 's' : ''}</span>}
                  {v.status && v.status !== 'Active' && <span className="text-amber-500">{v.status}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
