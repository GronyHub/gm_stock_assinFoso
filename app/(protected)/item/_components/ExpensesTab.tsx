'use client'
import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'

type Expense = {
  id: number
  expense_date: string
  expense_account: string
  description: string | null
  cf_justify: string | null
  vendor_name: string | null
  amount: string | null
  amount_hidden?: boolean
  cf_expense_type: string | null
  is_property: boolean
  property_status: string | null
  entered_by: string | null
  source: string | null
  source_sheet: string | null
}

type ExpTab = 'all' | 'properties' | 'at_shop' | 'away'

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string | null) {
  if (val == null) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTotal(expenses: Expense[]) {
  const total = expenses.reduce((s, e) => s + (e.amount != null ? parseFloat(e.amount) || 0 : 0), 0)
  return total.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_COLORS: Record<string, string> = {
  at_shop: 'text-green-600', not_at_shop: 'text-orange-500', spoilt: 'text-red-500',
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const ACCOUNTS = ['Office Expenses','Rent','Utilities','Salaries','Transport','Repairs','Supplies','Other']

const TH = 'text-left px-3 py-2 font-bold text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-200'
const TD = 'px-3 py-2'

type TableProps = {
  rows: Expense[]
  highlightId?: number | null
  editId: number | null
  confirmDeleteId: number | null
  deleting: boolean
  saving: boolean
  form: typeof EMPTY_FORM
  onEdit: (e: Expense) => void
  onCloseEdit: () => void
  onFormChange: (f: typeof EMPTY_FORM) => void
  onSaveEdit: () => void
  onDeleteStart: (id: number) => void
  onDeleteConfirm: (id: number) => void
  onDeleteCancel: () => void
  onPropertyStatus: (e: Expense, status: string) => void
  hideAccount?: boolean
  hideVendor?: boolean
  accounts: string[]
  vendors: string[]
  accountFilter: string | null
  vendorFilter: string | null
  onAccountFilter: (v: string | null) => void
  onVendorFilter: (v: string | null) => void
}

const EMPTY_FORM = {
  expense_date: '', expense_account: '', cf_justify: '', vendor_name: '',
  amount: '', cf_expense_type: '', is_property: false,
}

// Clicking the header opens a dropdown of every distinct value in that
// column -- picking one filters the table down to just that value; "All"
// clears it. The header itself turns blue while a filter is active.
function FilterHeaderCell({ label, options, value, onChange }: {
  label: string; options: string[]; value: string | null; onChange: (v: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <th className={`${TH} relative`} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-0.5 ${value ? 'text-blue-600' : ''}`}>
        <span className="truncate max-w-[80px]">{value ?? label}</span>
        <span className="text-[8px] shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 left-0 top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto min-w-[140px] normal-case font-normal">
          <button onClick={() => { onChange(null); setOpen(false) }}
            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition ${!value ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
            All
          </button>
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 transition ${value === o ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
              {o}
            </button>
          ))}
        </div>
      )}
    </th>
  )
}

function ExpenseTable({ rows, highlightId, editId, confirmDeleteId, deleting, saving, form, onEdit, onCloseEdit,
  onFormChange, onSaveEdit, onDeleteStart, onDeleteConfirm, onDeleteCancel, onPropertyStatus, hideAccount, hideVendor,
  accounts, vendors, accountFilter, vendorFilter, onAccountFilter, onVendorFilter }: TableProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
    <table className="w-full border-collapse text-xs">
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-50">
          <th className={`${TH} whitespace-nowrap`}>Date</th>
          <th className={`${TH} text-right`}>Amt</th>
          {!hideAccount && (
            <FilterHeaderCell label="Account" options={accounts} value={accountFilter} onChange={onAccountFilter} />
          )}
          <th className={TH}>Description</th>
          <th className={TH}>Justify</th>
          {!hideVendor && (
            <FilterHeaderCell label="Vendor" options={vendors} value={vendorFilter} onChange={onVendorFilter} />
          )}
          <th className={TH}>Source</th>
          <th className={TH}>By</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map((e, i) => (
          <Fragment key={e.id}>
            <tr id={`expense-${e.id}`}
              onClick={() => { if (e.amount_hidden) return; if (editId === e.id) onCloseEdit(); else onEdit(e) }}
              className={`transition-colors ${e.amount_hidden ? '' : 'cursor-pointer'} ${highlightId === e.id ? 'bg-yellow-100' : i % 2 === 1 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50/60`}>
              <td className={`${TD} text-gray-600 whitespace-nowrap`}>{fmtShort(e.expense_date)}</td>
              <td className={`${TD} text-right font-bold text-gray-900`}>{e.amount_hidden ? '🔒 Hidden' : `₵${fmt(e.amount)}`}</td>
              {!hideAccount && <td className={`${TD} text-gray-900 font-semibold`}>{e.expense_account}</td>}
              <td className={`${TD} text-gray-700`}>{e.description ?? '—'}</td>
              <td className={`${TD} text-gray-700`}>{e.cf_justify ?? '—'}</td>
              {!hideVendor && <td className={`${TD} text-gray-500`}>{e.vendor_name ?? '—'}</td>}
              <td className={`${TD} text-gray-400`}>{e.source_sheet ?? e.source ?? '—'}</td>
              <td className={`${TD} text-blue-500`}>{e.entered_by ?? '—'}</td>
            </tr>
            {editId === e.id && (
              <tr className="bg-blue-50/40">
                <td colSpan={8 - (hideAccount ? 1 : 0) - (hideVendor ? 1 : 0)} className="px-3 py-3">
                  <div className="grid grid-cols-2 gap-1 max-w-lg">
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                      <input type="date" value={form.expense_date}
                        onChange={ev => onFormChange({ ...form, expense_date: ev.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Amount (₵)</p>
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount}
                        onChange={ev => onFormChange({ ...form, amount: ev.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Account</p>
                      <input list="expense-accounts-edit" value={form.expense_account}
                        onChange={ev => onFormChange({ ...form, expense_account: ev.target.value })} className={inputCls} />
                      <datalist id="expense-accounts-edit">
                        {ACCOUNTS.map(a => <option key={a} value={a} />)}
                      </datalist>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Justify</p>
                      <input value={form.cf_justify}
                        onChange={ev => onFormChange({ ...form, cf_justify: ev.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Vendor</p>
                      <input value={form.vendor_name}
                        onChange={ev => onFormChange({ ...form, vendor_name: ev.target.value })} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 mb-0.5">Type</p>
                      <input value={form.cf_expense_type}
                        onChange={ev => onFormChange({ ...form, cf_expense_type: ev.target.value })} className={inputCls} />
                    </div>
                  </div>
                  {e.is_property && (
                    <div className="mt-1">
                      <p className="text-[9px] text-gray-400 mb-0.5">Property Status</p>
                      <select value={e.property_status ?? 'at_shop'}
                        onChange={ev => onPropertyStatus(e, ev.target.value)}
                        className={`${inputCls} w-auto ${STATUS_COLORS[e.property_status ?? ''] ?? 'text-gray-600'}`}>
                        <option value="at_shop">At Shop</option>
                        <option value="not_at_shop">Not at Shop</option>
                        <option value="spoilt">Spoilt</option>
                      </select>
                    </div>
                  )}
                  <div className="flex items-center gap-1 mt-2">
                    <button onClick={onSaveEdit} disabled={saving}
                      className="bg-green-600 text-white text-[10px] font-bold rounded px-3 py-1 disabled:opacity-40">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={onCloseEdit}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                    {/* Delete lives here, inside Edit, rather than as its own
                        button on every row -- one extra tap discourages
                        accidental deletes. */}
                    {confirmDeleteId === e.id ? (
                      <span className="ml-auto flex items-center gap-1">
                        <button onClick={() => onDeleteConfirm(e.id)} disabled={deleting}
                          className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded disabled:opacity-40">
                          {deleting ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                        <button onClick={onDeleteCancel}
                          className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => onDeleteStart(e.id)}
                        className="ml-auto px-3 py-1 bg-red-50 text-red-600 text-[10px] font-semibold rounded hover:bg-red-100">
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
    </div>
  )
}

type Props = { search: string; initialTab?: ExpTab }

export default function ExpensesTab({ search, initialTab }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ExpTab>(initialTab ?? 'all')
  const [groupBy, setGroupBy] = useState<'none' | 'account' | 'vendor'>('none')
  const [showHistory, setShowHistory] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState<string | null>(null)

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadExpenses() }, [])
  usePolling(loadExpenses, 5000, editId === null)


  const accountOptions = useMemo(() =>
    Array.from(new Set(expenses.map(e => e.expense_account).filter(Boolean))).sort()
  , [expenses])
  const vendorOptions = useMemo(() =>
    Array.from(new Set(expenses.map(e => e.vendor_name).filter((v): v is string => !!v))).sort()
  , [expenses])

  const filtered = useMemo(() => {
    let list = expenses
    if (tab === 'properties') list = list.filter(e => e.is_property)
    if (tab === 'at_shop')    list = list.filter(e => e.is_property && e.property_status === 'at_shop')
    if (tab === 'away')       list = list.filter(e => e.is_property && (e.property_status === 'not_at_shop' || e.property_status === 'spoilt'))
    if (accountFilter) list = list.filter(e => e.expense_account === accountFilter)
    if (vendorFilter)  list = list.filter(e => e.vendor_name === vendorFilter)
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.cf_justify ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.source_sheet ?? '').toLowerCase().includes(q) ||
      (e.source ?? '').toLowerCase().includes(q)
    )
  }, [expenses, tab, search, accountFilter, vendorFilter])

  const grouped = useMemo(() => {
    if (groupBy === 'none') return []
    const map = new Map<string, Expense[]>()
    for (const e of filtered) {
      const key = groupBy === 'account'
        ? (e.expense_account || 'Uncategorised')
        : (e.vendor_name || 'No Vendor')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered, groupBy])

  function openEdit(e: Expense) {
    if (e.amount_hidden) return
    setForm({
      expense_date: e.expense_date?.slice(0, 10) ?? '',
      expense_account: e.expense_account,
      cf_justify: e.cf_justify ?? '',
      vendor_name: e.vendor_name ?? '',
      amount: e.amount != null ? parseFloat(e.amount).toString() : '',
      cf_expense_type: e.cf_expense_type ?? '',
      is_property: e.is_property,
    })
    setEditId(e.id)
    setConfirmDeleteId(null)
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const body = {
      expense_date: form.expense_date || undefined,
      expense_account: form.expense_account,
      cf_justify: form.cf_justify || null,
      vendor_name: form.vendor_name || null,
      amount: parseFloat(form.amount),
      cf_expense_type: form.cf_expense_type || null,
      is_property: form.is_property,
    }
    const res = await fetch(`/api/expenses/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    if (res.ok) {
      const updated: Expense = await res.json()
      setExpenses(prev => prev.map(e => e.id === editId ? { ...e, ...updated } : e))
      setEditId(null)
    }
  }

  async function deleteExpense(id: number) {
    setDeleting(true)
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setExpenses(prev => prev.filter(e => e.id !== id))
      setConfirmDeleteId(null)
      setEditId(null)
    }
  }

  async function setPropertyStatus(expense: Expense, status: string) {
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_status: status }),
    })
    if (res.ok) setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, property_status: status } : e))
  }

  const tableProps = {
    highlightId, editId, confirmDeleteId, deleting, saving, form,
    onEdit: openEdit,
    onCloseEdit: () => { setEditId(null); setConfirmDeleteId(null) },
    onFormChange: setForm,
    onSaveEdit: saveEdit,
    onDeleteStart: (id: number) => setConfirmDeleteId(id),
    onDeleteConfirm: deleteExpense,
    onDeleteCancel: () => setConfirmDeleteId(null),
    onPropertyStatus: setPropertyStatus,
    accounts: accountOptions,
    vendors: vendorOptions,
    accountFilter,
    vendorFilter,
    onAccountFilter: setAccountFilter,
    onVendorFilter: setVendorFilter,
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const expTabs: { key: ExpTab; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'properties', label: 'Props' },
    { key: 'at_shop', label: 'At Shop' }, { key: 'away', label: 'Away' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap">
        {expTabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
              ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t.label}
          </button>
        ))}
        <div className="w-px h-3 bg-gray-300 shrink-0" />
        <button onClick={() => setGroupBy(g => g === 'account' ? 'none' : 'account')}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
            ${groupBy === 'account' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          By Account
        </button>
        <button onClick={() => setGroupBy(g => g === 'vendor' ? 'none' : 'vendor')}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
            ${groupBy === 'vendor' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
          By Vendor
        </button>
        <div className="w-px h-3 bg-gray-300 shrink-0" />
        <button onClick={() => setShowHistory(h => !h)}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
            ${showHistory ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          History
        </button>
        <span className="ml-auto text-[9px] text-gray-400">{filtered.length} records</span>
      </div>

      {showHistory && <HistoryPanel keywords={['expense']} onEntryClick={log => {
        // "added expense": "account · ₵200 on 2024-01-15"
        const dateMatch = log.details?.match(/on (\d{4}-\d{2}-\d{2})/)
        const accountMatch = log.details?.match(/^(.+?) ·/)
        const date = dateMatch?.[1]
        const account = accountMatch?.[1]
        const target = expenses.find(e =>
          (date ? e.expense_date?.startsWith(date) : true) &&
          (account ? e.expense_account === account : true)
        )
        setShowHistory(false)
        if (target) {
          setHighlightId(target.id)
          setTimeout(() => {
            document.getElementById(`expense-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
        }
      }} />}

      {!showHistory && <div className="flex-1 overflow-y-auto min-h-0 p-2">
        {groupBy !== 'none' ? (
          grouped.length === 0
            ? <p className="text-xs text-gray-400 text-center py-10">No expenses</p>
            : <div className="space-y-3">
              {grouped.map(([label, rows]) => (
                <div key={label}>
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-600 rounded-t-xl sticky top-0 z-20">
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-[10px] text-blue-100">
                      {rows.length} record{rows.length !== 1 ? 's' : ''} · {rows.some(r => r.amount_hidden) ? '🔒 Hidden' : `₵${fmtTotal(rows)}`}
                    </p>
                  </div>
                  <div className="[&>div]:rounded-t-none">
                    <ExpenseTable rows={rows} {...tableProps}
                      hideAccount={groupBy === 'account'}
                      hideVendor={groupBy === 'vendor'} />
                  </div>
                </div>
              ))}
            </div>
        ) : (
          <>
            <ExpenseTable rows={filtered} {...tableProps} />
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-10">No expenses</p>}
          </>
        )}
      </div>}
    </div>
  )
}
