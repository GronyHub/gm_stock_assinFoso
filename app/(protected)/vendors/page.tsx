'use client'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import LocationField from '@/components/LocationField'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from '../item/_components/columnPrefs'

type Vendor = {
  id: number
  display_name: string
  company_name: string | null
  email: string | null
  phone: string | null
  location: string | null
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

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

// Name stays sticky/always-visible (first column); these are the only ones
// the picker can hide/reorder/rename.
type ColKey = 'company' | 'phone' | 'email' | 'location' | 'status' | 'billed' | 'paid' | 'outstanding' | 'billCount'
type VendorColumn = ColumnDef<ColKey> & { align: 'left' | 'right'; tdClass: string; render: (v: Vendor) => ReactNode }
const VENDOR_COLUMNS: VendorColumn[] = [
  { key: 'company',  label: 'Company', align: 'left', tdClass: 'text-gray-600', render: v => v.company_name ?? '—' },
  { key: 'phone',    label: 'Contact Number', align: 'left', tdClass: 'text-gray-600', render: v => v.phone ?? '—' },
  { key: 'email',    label: 'Email Address', align: 'left', tdClass: 'text-gray-600', render: v => v.email ?? '—' },
  { key: 'location', label: 'Location', align: 'left', tdClass: 'text-gray-600', render: v => v.location ?? '—' },
  { key: 'status',   label: 'Status', align: 'left', tdClass: '', render: v => (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
        {v.status ?? '—'}
      </span>
    ) },
  { key: 'billed', label: 'Billed', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.bill_total) > 0 ? <span className="text-gray-900">{c(v.bill_total)}</span> : <span className="text-gray-300">—</span> },
  { key: 'paid', label: 'Paid', align: 'right', tdClass: 'font-semibold text-green-600', render: v => c(v.amount_paid) },
  { key: 'outstanding', label: 'Outstanding', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.outstanding) > 0 ? <span className="text-red-500">{c(v.outstanding)}</span> : <span className="text-gray-300">—</span> },
  { key: 'billCount', label: 'Bills', align: 'right', tdClass: 'text-gray-500', render: v => v.bill_count },
]
const VENDOR_COL_BY_KEY = new Map(VENDOR_COLUMNS.map(col => [col.key, col]))
const VENDORS_COL_DEFAULTS: Record<string, number> = {
  name: 150, company: 150, phone: 120, email: 180, location: 130, status: 90, billed: 100, paid: 100, outstanding: 110, billCount: 70,
}

function NewVendorForm({ onCreated, onCancel }: { onCreated: (v: Vendor) => void; onCancel: () => void }) {
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
    if (!displayName.trim()) { setError('Vendor name is required.'); return }

    setSaving(true)
    const res = await fetch('/api/vendors', {
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
      setError(d?.error ?? 'Could not save vendor.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">New Vendor</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
      </div>

      <div>
        <label className={labelCls}>Vendor Name</label>
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
          {saving ? 'Saving…' : 'Save Vendor'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
      </div>
    </div>
  )
}

function EditVendorForm({ vendor, onSaved, onCancel }: { vendor: Vendor; onSaved: (v: Vendor) => void; onCancel: () => void }) {
  const [companyName, setCompanyName] = useState(vendor.company_name ?? '')
  const [phone, setPhone] = useState(vendor.phone ?? '')
  const [email, setEmail] = useState(vendor.email ?? '')
  const [location, setLocation] = useState(vendor.location ?? '')
  const [notes, setNotes] = useState(vendor.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setSaving(true)
    const res = await fetch(`/api/vendors/${vendor.id}`, {
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
      <p className="text-xs font-bold text-blue-600">Edit Vendor</p>
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

export default function VendorsPage({ openAddSignal, initialSearch }: { openAddSignal?: number; initialSearch?: string } = {}) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch ?? '')
  const [selected, setSelected] = useState<Vendor | null>(null)
  const [editingVendor, setEditingVendor] = useState(false)
  const [showForm, setShowForm] = useState(false)
  // Vendors missing a contact number or location -- clicking narrows the
  // table below to just those, same flag language as Customers.
  const [showFlagged, setShowFlagged] = useState(false)
  const colPrefs = useColumnPrefs<ColKey>('vendorsTable', VENDOR_COLUMNS)

  // Driven by the RoleBar "+" shortcut menu.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openAddSignal) setShowForm(true)
  }, [openAddSignal])

  // Driven by the global search (page.tsx) landing here already knowing
  // which vendor to show -- also covers re-arriving with a different name
  // while this page is already mounted, not just the first mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    fetch('/api/vendors')
      .then(r => r.json())
      .then(d => { setVendors(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const noContactCount = useMemo(() => vendors.filter(x => !x.phone || !x.location).length, [vendors])

  const filtered = useMemo(() => {
    let v = vendors
    if (showFlagged) v = v.filter(x => !x.phone || !x.location)
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(x =>
        (x.display_name ?? '').toLowerCase().includes(q) ||
        (x.company_name ?? '').toLowerCase().includes(q) ||
        (x.phone ?? '').toLowerCase().includes(q)
      )
    }
    return v
  }, [vendors, showFlagged, search])

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
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{vendors.length} vendors</span>
          <ColumnsPickerButton prefs={colPrefs} />
          <button onClick={() => setShowForm(f => !f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition
              ${showForm ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            {showForm ? '×' : '+ New Vendor'}
          </button>
        </div>
      </div>

      {showForm && (
        <NewVendorForm
          onCancel={() => setShowForm(false)}
          onCreated={created => { setVendors(prev => [created, ...prev]); setShowForm(false) }}
        />
      )}

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

      {/* Search + flag -- the old external/internal/outstanding tabs are
          gone, "all" (i.e. no filter) already showed every vendor, so the
          full list is just always shown here now. */}
      <div className="space-y-2">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button onClick={() => setShowFlagged(v => !v)} title="Vendors with no contact number or location"
          className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold pl-1.5 pr-2 py-1 rounded-lg transition
            ${showFlagged ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'}`}>
          <span className="relative leading-none">
            {noContactCount > 0 ? '🚩' : '🏳️'}
            <span className={`absolute -bottom-1 -right-1 text-[6px] font-black leading-none rounded-sm px-[1px]
              ${noContactCount > 0 ? 'bg-white text-red-700' : 'bg-red-700 text-white'}`}>C</span>
          </span>
          <span>{noContactCount > 0 ? noContactCount : ''}</span>
        </button>
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
            <div className="flex items-center gap-2 shrink-0">
              {!editingVendor && (
                <button onClick={() => setEditingVendor(true)}
                  className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100">
                  ✏️ Edit
                </button>
              )}
              <button onClick={() => { setSelected(null); setEditingVendor(false) }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>
          </div>

          {editingVendor ? (
            <EditVendorForm vendor={selected}
              onCancel={() => setEditingVendor(false)}
              onSaved={updated => {
                const merged = { ...selected, ...updated }
                setSelected(merged)
                setVendors(prev => prev.map(x => x.id === merged.id ? merged : x))
                setEditingVendor(false)
              }} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-gray-100 pt-3">
                <div><span className="text-gray-400">Phone: </span><span className="font-medium">{selected.phone ?? '—'}</span></div>
                <div><span className="text-gray-400">Email: </span><span className="font-medium">{selected.email ?? '—'}</span></div>
                <div><span className="text-gray-400">Location: </span><span className="font-medium">{selected.location ?? '—'}</span></div>
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
            </>
          )}
        </div>
      )}

      {/* Vendor table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">No vendors found.</p>
        ) : (
          <table className="border-collapse text-xs" style={{
            tableLayout: 'fixed',
            width: colPrefs.getWidth('name', VENDORS_COL_DEFAULTS.name)
              + colPrefs.shownColumns.reduce((s, c) => s + colPrefs.getWidth(c.key, VENDORS_COL_DEFAULTS[c.key] ?? 100), 0),
          }}>
            <colgroup>
              <col style={{ width: colPrefs.getWidth('name', VENDORS_COL_DEFAULTS.name) }} />
              {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, VENDORS_COL_DEFAULTS[c.key] ?? 100) }} />)}
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                <ResizableTh onResize={d => colPrefs.resizeWidth('name', d, VENDORS_COL_DEFAULTS.name)} onReset={() => colPrefs.resetWidth('name')}>Name</ResizableTh>
                {colPrefs.shownColumns.map((col, i) => (
                  <ResizableTh key={col.key} align={VENDOR_COL_BY_KEY.get(col.key)!.align} noDivider={i === colPrefs.shownColumns.length - 1}
                    onResize={d => colPrefs.resizeWidth(col.key, d, VENDORS_COL_DEFAULTS[col.key] ?? 100)} onReset={() => colPrefs.resetWidth(col.key)}>
                    {col.label}
                  </ResizableTh>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v, i) => (
                <tr key={v.id} onClick={() => { setSelected(v === selected ? null : v); setEditingVendor(false) }}
                  className={`cursor-pointer transition ${selected?.id === v.id ? 'bg-blue-50' : i % 2 === 1 ? 'bg-gray-50/60 hover:bg-blue-50/40' : 'hover:bg-blue-50/40'}`}>
                  <td className="px-3 py-2 font-semibold text-gray-900 truncate">
                    {v.is_internal && (
                      <span className="mr-1 text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full align-middle">INT</span>
                    )}
                    {v.display_name}
                  </td>
                  {colPrefs.shownColumns.map(col => {
                    const meta = VENDOR_COL_BY_KEY.get(col.key)!
                    return (
                      <td key={col.key} className={`px-3 py-2 truncate ${meta.align === 'right' ? 'text-right' : ''} ${meta.tdClass}`}>
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
