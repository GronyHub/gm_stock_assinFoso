'use client'
import { useState, useEffect, useMemo, type ReactNode } from 'react'
import LocationField from '@/components/LocationField'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, ColResizeHandle, type ColumnDef } from '../item/_components/columnPrefs'
import PageLawsList from '../item/_components/PageLawsList'
import LawsToggleBar from '../item/_components/LawsToggleBar'
import { useLawsPanel } from '../item/_components/useLawsPanel'

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
  whatsapp_group_added: boolean
  last_visited: string | null
  service_goods: string | null
  created_at: string
  receipt_count: number
  receipt_total: string
  receipt_balance: string
  invoice_count: number
  invoice_total: string
  invoice_outstanding: string
}

function fmtDateShort(d: string | null) {
  if (!d) return '—'
  return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function sevenDaysAgo() {
  return Date.now() - 7 * 86400000
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

// Name stays sticky/always-visible (first column); these are the only ones
// the picker can hide/reorder/rename.
type ColKey = 'company' | 'phone' | 'email' | 'location' | 'status' | 'lastVisited' | 'serviceGoods' | 'whatsapp' | 'sales' | 'outstanding' | 'receiptCount'
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
  { key: 'lastVisited', label: 'Last Visited', align: 'left', tdClass: 'text-gray-600', render: v => fmtDateShort(v.last_visited) },
  { key: 'serviceGoods', label: 'Service/Goods', align: 'left', tdClass: 'text-gray-600', render: v => v.service_goods ?? '—' },
  { key: 'whatsapp', label: 'WhatsApp Grp', align: 'left', tdClass: '', render: v => (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${v.whatsapp_group_added ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}`}>
        {v.whatsapp_group_added ? '✓ Added' : '✗ Not Added'}
      </span>
    ) },
  { key: 'sales', label: 'Sales Amount', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.receipt_total) > 0 ? <span className="text-gray-900">{c(v.receipt_total)}</span> : <span className="text-gray-300">—</span> },
  { key: 'outstanding', label: 'Outstanding', align: 'right', tdClass: 'font-semibold', render: v =>
      parseFloat(v.invoice_outstanding) > 0 ? <span className="text-red-500">{c(v.invoice_outstanding)}</span> : <span className="text-gray-300">—</span> },
  { key: 'receiptCount', label: 'Receipts', align: 'right', tdClass: 'text-gray-500', render: v => v.receipt_count },
]
const CUSTOMER_COL_BY_KEY = new Map(CUSTOMER_COLUMNS.map(col => [col.key, col]))
const CUSTOMERS_COL_DEFAULTS: Record<string, number> = {
  name: 150, company: 150, phone: 120, email: 180, location: 130, status: 90,
  lastVisited: 110, serviceGoods: 140, whatsapp: 100, sales: 100, outstanding: 110, receiptCount: 80,
}

function EditCustomerForm({ customer, onSaved, onCancel, onDeleted }: { customer: Customer; onSaved: (c: Customer) => void; onCancel: () => void; onDeleted?: () => void }) {
  const [companyName, setCompanyName] = useState(customer.company_name ?? '')
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [email, setEmail] = useState(customer.email ?? '')
  const [location, setLocation] = useState(customer.location ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [lastVisited, setLastVisited] = useState(customer.last_visited?.slice(0, 10) ?? '')
  const [serviceGoods, setServiceGoods] = useState(customer.service_goods ?? '')
  const [whatsappAdded, setWhatsappAdded] = useState(customer.whatsapp_group_added)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

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
        last_visited: lastVisited || null,
        service_goods: serviceGoods.trim() || null,
        whatsapp_group_added: whatsappAdded,
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

  async function handleDelete() {
    setError(null)
    setDeleting(true)
    const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setShowDeleteConfirm(false)
      onDeleted?.()
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Could not delete customer.')
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Last Visited</label>
          <input type="date" value={lastVisited} onChange={e => setLastVisited(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Service/Goods</label>
          <input value={serviceGoods} onChange={e => setServiceGoods(e.target.value)}
            placeholder="e.g. Printing, Photocopies" className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={whatsappAdded} onChange={() => setWhatsappAdded(v => !v)}
          className="w-3.5 h-3.5 accent-blue-600" />
        <span className="text-xs font-semibold text-gray-700">Added to Group Whatsapp Page</span>
      </label>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      {showDeleteConfirm && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-red-700">Delete customer "{customer.display_name}"?</p>
          <p className="text-xs text-red-600">This action cannot be undone. Customer must not have any related sales receipts or invoices.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition">
              {deleting ? 'Deleting…' : 'Delete Customer'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
              className="px-3 py-2 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving || deleting}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} disabled={saving || deleting} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
        <button onClick={() => setShowDeleteConfirm(true)} disabled={saving || deleting}
          className="px-4 py-2.5 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100">Delete</button>
      </div>
    </div>
  )
}

// Flag categories, letter shown beside the flag icon (see the button row
// below) -- 'new_week' is a shop-wide threshold, not a per-customer problem,
// so it's excluded from FLAG_TYPES and shown as its own banner instead.
type FlagKey = 'location' | 'phone' | 'email' | 'whatsapp'
const FLAG_TYPES: { key: FlagKey; letter: string; label: string }[] = [
  { key: 'location', letter: 'L', label: 'No Location' },
  { key: 'phone', letter: 'C', label: 'No Contact Number' },
  { key: 'email', letter: 'E', label: 'No Email Address' },
  { key: 'whatsapp', letter: 'W', label: 'Not Added to Group Whatsapp' },
]
const NEW_CUSTOMERS_PER_WEEK_TARGET = 10

export default function CustomersPage({ initialSearch, onFlagCountChange }: { initialSearch?: string; onFlagCountChange?: (n: number) => void } = {}) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(initialSearch ?? '')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [editingCustomer, setEditingCustomer] = useState(false)
  const [activeFlag, setActiveFlag] = useState<FlagKey | null>(null)
  const lawsPanel = useLawsPanel('showCustomersLaws')
  const colPrefs = useColumnPrefs<ColKey>('customersTable', CUSTOMER_COLUMNS)

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

  const flagCounts = useMemo(() => ({
    location: customers.filter(x => !x.location).length,
    phone: customers.filter(x => !x.phone).length,
    email: customers.filter(x => !x.email).length,
    whatsapp: customers.filter(x => !x.whatsapp_group_added).length,
  }), [customers])
  // Reports this page's own flag total up to item/page.tsx's pane badge --
  // these four never went through the centralized violations system other
  // pages' pane badges read from, so the Customers pane row never showed
  // them until this existed.
  useEffect(() => {
    onFlagCountChange?.(flagCounts.location + flagCounts.phone + flagCounts.email + flagCounts.whatsapp)
  }, [flagCounts, onFlagCountChange])

  // Rolling 7-day window ending today -- there's no reliable historical
  // signup date (created_at was only just added, see ensureColumns), so
  // this only ever looks at the trailing week, not every week since data
  // started.
  const newThisWeek = useMemo(() => {
    const cutoff = sevenDaysAgo()
    return customers.filter(x => x.created_at && new Date(x.created_at).getTime() >= cutoff).length
  }, [customers])

  const filtered = useMemo(() => {
    let v = customers
    if (activeFlag === 'location') v = v.filter(x => !x.location)
    else if (activeFlag === 'phone') v = v.filter(x => !x.phone)
    else if (activeFlag === 'email') v = v.filter(x => !x.email)
    else if (activeFlag === 'whatsapp') v = v.filter(x => !x.whatsapp_group_added)
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
  }, [customers, activeFlag, search])

  const totals = useMemo(() => ({
    customers:   customers.length,
    receipts:    customers.reduce((s, x) => s + x.receipt_count, 0),
    sales:       customers.reduce((s, x) => s + parseFloat(x.receipt_total), 0),
    outstanding: customers.reduce((s, x) => s + parseFloat(x.invoice_outstanding), 0),
  }), [customers])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      {/* Law/Notes/Tasks + this page's own flag pills, together in one row
          at the very top -- same treatment as Items/Sales/Bills' own green
          header row. One small button per category (🚩/🏳️ + letter +
          count), clicking narrows the table below to just that category's
          flagged customers. "New customers this week" is a shop-wide
          threshold, not a per-customer problem, so it's a plain banner
          instead of a filter. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
        <span className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold pl-1.5 pr-2 py-1 rounded-lg
          ${newThisWeek < NEW_CUSTOMERS_PER_WEEK_TARGET ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
          title="New customers added in the last 7 days">
          <span className="relative leading-none">
            {newThisWeek < NEW_CUSTOMERS_PER_WEEK_TARGET ? '🚩' : '🏳️'}
            <span className={`absolute -bottom-1 -right-1 text-[6px] font-black leading-none rounded-sm px-[1px]
              ${newThisWeek < NEW_CUSTOMERS_PER_WEEK_TARGET ? 'bg-white text-red-700' : 'bg-green-700 text-white'}`}>N</span>
          </span>
          <span>{newThisWeek}/{NEW_CUSTOMERS_PER_WEEK_TARGET} this week</span>
        </span>
        {activeFlag && (
          <button onClick={() => setActiveFlag(null)} className="text-[10px] font-semibold text-blue-600 hover:text-blue-700">
            Clear filter
          </button>
        )}
      </div>

      {lawsPanel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList
            scopeKey="Customers"
            isItemsLaws={true}
            onChange={lawsPanel.bumpRefresh}
            flags={FLAG_TYPES.map(({ key, label }) => ({ key, label, count: flagCounts[key], onViewClick: () => setActiveFlag(key as FlagKey) }))}
            openForm={lawsPanel.openForm}
            setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags}
            setHideZeroFlags={lawsPanel.setHideZeroFlags}
            activeFilters={lawsPanel.activeFilters}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Customers</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{customers.length} contacts</span>
          <ColumnsPickerButton prefs={colPrefs} />
        </div>
      </div>

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
              }}
              onDeleted={() => {
                setCustomers(prev => prev.filter(x => x.id !== selected.id))
                setSelected(null)
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
                <div><span className="text-gray-400">Last Visited: </span><span className="font-medium">{fmtDateShort(selected.last_visited)}</span></div>
                <div><span className="text-gray-400">Service/Goods: </span><span className="font-medium">{selected.service_goods ?? '—'}</span></div>
                <div><span className="text-gray-400">WhatsApp Grp: </span><span className={`font-medium ${selected.whatsapp_group_added ? 'text-green-700' : 'text-red-600'}`}>{selected.whatsapp_group_added ? '✓ Added' : '✗ Not Added'}</span></div>
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
          <table className="border-collapse text-xs" style={{
            tableLayout: 'fixed',
            width: colPrefs.getWidth('name', CUSTOMERS_COL_DEFAULTS.name)
              + colPrefs.shownColumns.reduce((s, c) => s + colPrefs.getWidth(c.key, CUSTOMERS_COL_DEFAULTS[c.key] ?? 100), 0),
          }}>
            <colgroup>
              <col style={{ width: colPrefs.getWidth('name', CUSTOMERS_COL_DEFAULTS.name) }} />
              {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, CUSTOMERS_COL_DEFAULTS[c.key] ?? 100) }} />)}
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                <th className="relative overflow-hidden text-left px-3 py-2 font-bold border-b border-r border-gray-200 sticky left-0 z-10 bg-gray-50">
                  <span className="block truncate">Name</span>
                  <ColResizeHandle onResize={d => colPrefs.resizeWidth('name', d, CUSTOMERS_COL_DEFAULTS.name)} onReset={() => colPrefs.resetWidth('name')} />
                </th>
                {colPrefs.shownColumns.map((col, i) => (
                  <ResizableTh key={col.key} align={CUSTOMER_COL_BY_KEY.get(col.key)!.align} noDivider={i === colPrefs.shownColumns.length - 1}
                    onResize={d => colPrefs.resizeWidth(col.key, d, CUSTOMERS_COL_DEFAULTS[col.key] ?? 100)} onReset={() => colPrefs.resetWidth(col.key)}>
                    {col.label}
                  </ResizableTh>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v, i) => (
                <tr key={v.id} onClick={() => { setSelected(v === selected ? null : v); setEditingCustomer(false) }}
                  className={`cursor-pointer transition ${selected?.id === v.id ? 'bg-blue-50' : i % 2 === 1 ? 'bg-gray-50/60 hover:bg-blue-50/40' : 'hover:bg-blue-50/40'}`}>
                  <td className="px-3 py-2 font-semibold text-gray-900 truncate sticky left-0 z-[1] bg-inherit">
                    {v.is_internal && (
                      <span className="mr-1 text-[9px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded-full align-middle">INT</span>
                    )}
                    {v.display_name}
                  </td>
                  {colPrefs.shownColumns.map(col => {
                    const meta = CUSTOMER_COL_BY_KEY.get(col.key)!
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
