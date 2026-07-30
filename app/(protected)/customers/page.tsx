'use client'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import LocationField from '@/components/LocationField'
import { useColumnPrefs, ColumnsPickerButton, type ColumnDef } from '../item/_components/columnPrefs'

type Customer = {
  id: number
  display_name: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  location: string | null
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

// Name stays sticky/always-visible (first column); these are the only ones
// the picker can hide/reorder/rename.
type ColKey = 'company' | 'phone' | 'email' | 'location' | 'status' | 'sales' | 'outstanding' | 'receiptCount'
type CustomerColumn = ColumnDef<ColKey> & { align: 'left' | 'right'; tdClass: string; render: (v: Customer) => ReactNode }
const CUSTOMER_COLUMNS: CustomerColumn[] = [
  { key: 'company',  label: 'Company', align: 'left', tdClass: 'text-gray-600', render: v => v.company_name ?? '—' },
  { key: 'phone',    label: 'Contact Number', align: 'left', tdClass: 'text-gray-600', render: v => v.phone ?? '—' },
  { key: 'email',    label: 'Email Address', align: 'left', tdClass: 'text-gray-600', render: v => v.email ?? '—' },
  { key: 'location', label: 'Location', align: 'left', tdClass: 'text-gray-600', render: v => v.location ?? '—' },
  { key: 'status',   label: 'Status', align: 'left', tdClass: '', render: v => (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {v.status ?? '—'}
      </span>
    ) },
  { key: 'sales', label: 'Sales Amount', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.receipt_total) > 0 ? <span className="text-gray-900">{c(v.receipt_total)}</span> : <span className="text-gray-300">—</span> },
  { key: 'outstanding', label: 'Outstanding', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.invoice_outstanding) > 0 ? <span className="text-red-500">{c(v.invoice_outstanding)}</span> : <span className="text-gray-300">—</span> },
  { key: 'receiptCount', label: 'Receipts', align: 'right', tdClass: 'text-gray-500', render: v => v.receipt_count },
]
const CUSTOMER_COL_BY_KEY = new Map(CUSTOMER_COLUMNS.map(col => [col.key, col]))

function NewCustomerForm({ onCreated, onCancel }: { onCreated: (c: Customer) => void; onCancel: () => void }) {
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [location, setLocation] = useState('')
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
        location: location.trim() || null,
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
      <LocationField value={location} onChange={setLocation} />
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

function EditCustomerForm({ customer, onSaved, onCancel }: { customer: Customer; onSaved: (c: Customer) => void; onCancel: () => void }) {
  const [companyName, setCompanyName] = useState(customer.company_name ?? '')
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [location, setLocation] = useState(customer.location ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/customers/${customer.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onSaved(await res.json())
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Could not save changes.')
    }
  }

  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <p className="text-xs font-bold text-blue-600">Edit Customer</p>
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
      <LocationField value={location} onChange={setLocation} />
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} disabled={saving} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
      </div>
    </div>
  )
}

export default function CustomersPage({ openAddSignal, initialSearch }: { openAddSignal?: number; initialSearch?: string } = {}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch ?? '')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const colPrefs = useColumnPrefs<ColKey>('customersTable', CUSTOMER_COLUMNS)

  // Driven by the RoleBar "+" shortcut menu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openAddSignal) setShowForm(true)
  }, [openAddSignal])

  // Driven by the global search (page.tsx) landing here already knowing
  // which customer to show -- also covers re-arriving with a different
  // name while this page is already mounted, not just the first mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    fetch('/api/customers')
      .then(r => r.json())
      .then(d => { setCustomers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let v = customers
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
  }, [customers, search])

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
          <ColumnsPickerButton prefs={colPrefs} />
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

      {/* Summary line -- one plain row instead of four boxed cards */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
        <span>Total Sales <b className="text-gray-900 font-bold">{c(String(totals.sales))}</b></span>
        <span>Receipts <b className="text-blue-700 font-bold">{totals.receipts}</b></span>
        <span>Outstanding <b className={`font-bold ${totals.outstanding > 0 ? 'text-red-600' : 'text-gray-400'}`}>{c(String(totals.outstanding))}</b></span>
        <span>Customers <b className="text-purple-700 font-bold">{totals.customers}</b></span>
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search customers…"
        className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
      />

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
            <div className="flex items-center gap-2 shrink-0">
              {!editingCustomer && (
                <button onClick={() => setEditingCustomer(true)}
                  className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100">
                  ✏️ Edit
                </button>
              )}
              <button onClick={() => { setSelected(null); setEditingCustomer(false) }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>
          </div>

          {editingCustomer ? (
            <EditCustomerForm customer={selected}
              onCancel={() => setEditingCustomer(false)}
              onSaved={updated => {
                const merged = { ...selected, ...updated }
                setSelected(merged)
                setCustomers(prev => prev.map(x => x.id === merged.id ? merged : x))
                setEditingCustomer(false)
              }} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-3">
                <div><span className="text-gray-400">Phone: </span><span className="font-medium">{selected.phone ?? '—'}</span></div>
                <div><span className="text-gray-400">Email: </span><span className="font-medium">{selected.email ?? '—'}</span></div>
                <div><span className="text-gray-400">Location: </span><span className="font-medium">{selected.location ?? '—'}</span></div>
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
            </>
          )}
        </div>
      )}

      {/* Customer table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">No customers found.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap sticky left-0 z-10 bg-gray-50">Name</th>
                {colPrefs.shownColumns.map(col => (
                  <th key={col.key} className={`${CUSTOMER_COL_BY_KEY.get(col.key)!.align === 'right' ? 'text-right' : 'text-left'} px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v, i) => (
                <tr key={v.id} onClick={() => { setSelected(v === selected ? null : v); setEditingCustomer(false) }}
                  className={`cursor-pointer transition ${selected?.id === v.id ? 'bg-blue-50' : i % 2 === 1 ? 'bg-gray-50/60 hover:bg-blue-50/40' : 'hover:bg-blue-50/40'}`}>
                  <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap sticky left-0 z-[1] bg-inherit">
                    {v.is_internal && (
                      <span className="mr-1 text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full align-middle">INT</span>
                    )}
                    {v.display_name}
                  </td>
                  {colPrefs.shownColumns.map(col => {
                    const meta = CUSTOMER_COL_BY_KEY.get(col.key)!
                    return (
                      <td key={col.key} className={`px-3 py-2 whitespace-nowrap ${meta.align === 'right' ? 'text-right' : ''} ${meta.tdClass}`}>
                        {meta.render(v)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
