'use client'
import { Fragment, useState, useEffect, useMemo, useRef } from 'react'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, ColResizeHandle, type ColumnDef, type ColumnPrefs } from './columnPrefs'

type Expense = {
  id: number
  expense_date: string
  expense_account: string
  description: string | null
  vendor_name: string | null
  amount: string | null
  amount_hidden?: boolean
  cf_expense_type: string | null
  is_property: boolean
  availability: string | null
  working: string | null
  location: string | null
  not_working_reason: string | null
  not_available_reason: string | null
  entered_by: string | null
  source: string | null
  source_sheet: string | null
}

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

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const ACCOUNTS = ['Office Expenses','Rent','Utilities','Salaries','Transport','Repairs','Supplies','Other']

// Cheap edit-distance check for the "similar account names" flag -- catches
// near-duplicates like "Office Expense" vs "Office Expenses" without
// needing a DB round trip, since the full account list is already loaded.
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

// A description mentioning more than one item (a comma, "&", " and ", or
// "etc") suggests several purchases got lumped into a single expense line
// instead of each getting its own row.
function looksBundled(description: string | null): boolean {
  if (!description) return false
  return /[,&]|\band\b|\betc\b/i.test(description)
}

const TH = 'text-left px-3 py-2 font-bold text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-200'
const TD = 'px-3 py-2'

// Date and Amt stay sticky/always-visible (first two columns); these five
// are the only ones the picker can hide/reorder/rename. Account and Vendor
// also get force-hidden while grouped by that same field (see hideAccount/
// hideVendor below) -- that's independent of the picker's own choice.
type ColKey = 'account' | 'description' | 'vendor' | 'source' | 'by'
const EXPENSE_COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'account',     label: 'Account' },
  { key: 'description', label: 'Description' },
  { key: 'vendor',      label: 'Vendor' },
  { key: 'source',      label: 'Source' },
  { key: 'by',          label: 'By' },
]
const EXPENSES_COL_DEFAULTS: Record<string, number> = {
  date: 92, amt: 90, account: 120, description: 160, vendor: 120, source: 90, by: 80,
}

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
  colPrefs: ColumnPrefs<ColKey>
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
  expense_date: '', expense_account: '', description: '', vendor_name: '',
  amount: '', cf_expense_type: '', is_property: false,
}

// Clicking the header opens a dropdown of every distinct value in that
// column -- picking one filters the table down to just that value; "All"
// clears it. The header itself turns blue while a filter is active.
function FilterHeaderCell({ label, options, value, onChange, onResize, onResetWidth }: {
  label: string; options: string[]; value: string | null; onChange: (v: string | null) => void
  onResize: (deltaPx: number) => void; onResetWidth: () => void
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
    <th className={`${TH} relative overflow-hidden border-r`} ref={ref}>
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
      <ColResizeHandle onResize={onResize} onReset={onResetWidth} />
    </th>
  )
}

function ExpenseTable({ rows, highlightId, editId, confirmDeleteId, deleting, saving, form, onEdit, onCloseEdit,
  onFormChange, onSaveEdit, onDeleteStart, onDeleteConfirm, onDeleteCancel, colPrefs, hideAccount, hideVendor,
  accounts, vendors, accountFilter, vendorFilter, onAccountFilter, onVendorFilter }: TableProps) {
  const visibleKeys = colPrefs.colOrder.filter(k => colPrefs.visibleCols.has(k)
    && !(k === 'account' && hideAccount) && !(k === 'vendor' && hideVendor))

  function headerCellFor(key: ColKey, isLast: boolean) {
    const label = colPrefs.columnLabels[key] ?? EXPENSE_COLUMNS.find(c => c.key === key)!.label
    const onResize = (d: number) => colPrefs.resizeWidth(key, d, EXPENSES_COL_DEFAULTS[key] ?? 100)
    const onReset = () => colPrefs.resetWidth(key)
    if (key === 'account') return <FilterHeaderCell key={key} label={label} options={accounts} value={accountFilter} onChange={onAccountFilter} onResize={onResize} onResetWidth={onReset} />
    if (key === 'vendor') return <FilterHeaderCell key={key} label={label} options={vendors} value={vendorFilter} onChange={onVendorFilter} onResize={onResize} onResetWidth={onReset} />
    return <ResizableTh key={key} noDivider={isLast} onResize={onResize} onReset={onReset}>{label}</ResizableTh>
  }
  function bodyCellFor(key: ColKey, e: Expense) {
    if (key === 'account') return <td key={key} className={`${TD} text-gray-900 font-semibold truncate`}>{e.expense_account}</td>
    if (key === 'description') return <td key={key} className={`${TD} text-gray-700 truncate`}>{e.description ?? '—'}</td>
    if (key === 'vendor') return <td key={key} className={`${TD} text-gray-500 truncate`}>{e.vendor_name ?? '—'}</td>
    if (key === 'source') return <td key={key} className={`${TD} text-gray-400 truncate`}>{e.source_sheet ?? e.source ?? '—'}</td>
    return <td key={key} className={`${TD} text-blue-500 truncate`}>{e.entered_by ?? '—'}</td>
  }

  const tableWidth = colPrefs.getWidth('date', EXPENSES_COL_DEFAULTS.date) + colPrefs.getWidth('amt', EXPENSES_COL_DEFAULTS.amt)
    + visibleKeys.reduce((s, k) => s + colPrefs.getWidth(k, EXPENSES_COL_DEFAULTS[k] ?? 100), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
    <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: tableWidth }}>
      <colgroup>
        <col style={{ width: colPrefs.getWidth('date', EXPENSES_COL_DEFAULTS.date) }} />
        <col style={{ width: colPrefs.getWidth('amt', EXPENSES_COL_DEFAULTS.amt) }} />
        {visibleKeys.map(k => <col key={k} style={{ width: colPrefs.getWidth(k, EXPENSES_COL_DEFAULTS[k] ?? 100) }} />)}
      </colgroup>
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-50">
          <ResizableTh onResize={d => colPrefs.resizeWidth('date', d, EXPENSES_COL_DEFAULTS.date)} onReset={() => colPrefs.resetWidth('date')}>Date</ResizableTh>
          <ResizableTh align="right" onResize={d => colPrefs.resizeWidth('amt', d, EXPENSES_COL_DEFAULTS.amt)} onReset={() => colPrefs.resetWidth('amt')}>Amt</ResizableTh>
          {visibleKeys.map((key, i) => headerCellFor(key, i === visibleKeys.length - 1))}
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
              {visibleKeys.map(k => bodyCellFor(k, e))}
            </tr>
            {editId === e.id && (
              <tr className="bg-blue-50/40">
                <td colSpan={2 + visibleKeys.length} className="px-3 py-3">
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
                      <p className="text-[9px] text-gray-400 mb-0.5">Description</p>
                      <input value={form.description}
                        onChange={ev => onFormChange({ ...form, description: ev.target.value })} className={inputCls} />
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
                  <div className="mt-2">
                    <p className="text-[9px] text-gray-400 mb-0.5">Property?</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={`is-property-${e.id}`} checked={form.is_property === true}
                          onChange={() => onFormChange({ ...form, is_property: true })}
                          className="w-3 h-3 accent-blue-600" />
                        <span className="text-[10px] text-gray-700">Property</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={`is-property-${e.id}`} checked={form.is_property === false}
                          onChange={() => onFormChange({ ...form, is_property: false })}
                          className="w-3 h-3 accent-blue-600" />
                        <span className="text-[10px] text-gray-700">Not a property</span>
                      </label>
                    </div>
                  </div>
                  {e.is_property && (
                    <p className="mt-1 text-[9px] text-blue-600 bg-blue-50 rounded px-2 py-1">
                      Manage this property&apos;s availability/condition on the Properties page (Grony Manage).
                    </p>
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

type Props = { search: string; onFlagCountChange?: (n: number) => void }

export default function ExpensesTab({ search, onFlagCountChange }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [groupBy, setGroupBy] = useState<'none' | 'account' | 'vendor'>('none')
  const [showHistory, setShowHistory] = useState(false)
  const lawsPanel = useLawsPanel('showExpensesLaws')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [vendorFilter, setVendorFilter] = useState<string | null>(null)
  // Independent of the All/Props/At Shop/Away tabs -- unchecking either one
  // drops that side of the is_property split from the list.
  const [showProperties, setShowProperties] = useState(true)
  const [showNonProperties, setShowNonProperties] = useState(true)
  // 'similar' narrows to expenses whose account name is part of a
  // near-duplicate pair; 'bundled' to descriptions that read like more than
  // one purchase; 'no_vendor' to expenses missing a vendor name.
  const [activeFlag, setActiveFlag] = useState<'similar' | 'bundled' | 'no_vendor' | 'properties_no_location' | null>(null)
  const colPrefs = useColumnPrefs<ColKey>('expensesTable', EXPENSE_COLUMNS)

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadExpenses() }, [])
  usePolling(loadExpenses, 60000, editId === null)

  const accountOptions = useMemo(() =>
    Array.from(new Set(expenses.map(e => e.expense_account).filter(Boolean))).sort()
  , [expenses])
  const vendorOptions = useMemo(() =>
    Array.from(new Set(expenses.map(e => e.vendor_name).filter((v): v is string => !!v))).sort()
  , [expenses])

  // Account names close enough to each other (but not identical) that they
  // probably mean the same account entered two different ways.
  const similarAccountNames = useMemo(() => {
    const flagged = new Set<string>()
    for (let i = 0; i < accountOptions.length; i++) {
      for (let j = i + 1; j < accountOptions.length; j++) {
        const a = accountOptions[i], b = accountOptions[j]
        if (a.toLowerCase() === b.toLowerCase()) continue
        if (levenshtein(a.toLowerCase(), b.toLowerCase()) <= 2) { flagged.add(a); flagged.add(b) }
      }
    }
    return flagged
  }, [accountOptions])

  const flagCounts = useMemo(() => ({
    similar: expenses.filter(e => similarAccountNames.has(e.expense_account)).length,
    bundled: expenses.filter(e => looksBundled(e.description)).length,
    no_vendor: expenses.filter(e => !e.vendor_name).length,
    properties_no_location: expenses.filter(e => e.is_property && e.availability === 'available' && !e.location).length,
  }), [expenses, similarAccountNames])
  // Reports this page's own flag total up to item/page.tsx's pane badge --
  // these are local to Expenses (never went through the centralized
  // violations system other pages' pane badges read from), so the count on
  // the Expenses pane row never showed them until this existed.
  useEffect(() => {
    onFlagCountChange?.(flagCounts.similar + flagCounts.bundled + flagCounts.no_vendor + flagCounts.properties_no_location)
  }, [flagCounts, onFlagCountChange])

  const filtered = useMemo(() => {
    let list = expenses
    if (activeFlag === 'similar') list = list.filter(e => similarAccountNames.has(e.expense_account))
    else if (activeFlag === 'bundled') list = list.filter(e => looksBundled(e.description))
    else if (activeFlag === 'no_vendor') list = list.filter(e => !e.vendor_name)
    else if (activeFlag === 'properties_no_location') list = list.filter(e => e.is_property && e.availability === 'available' && !e.location)
    if (accountFilter) list = list.filter(e => e.expense_account === accountFilter)
    if (vendorFilter)  list = list.filter(e => e.vendor_name === vendorFilter)
    if (!showProperties || !showNonProperties) {
      list = list.filter(e => e.is_property ? showProperties : showNonProperties)
    }
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.source_sheet ?? '').toLowerCase().includes(q) ||
      (e.source ?? '').toLowerCase().includes(q)
    )
  }, [expenses, search, accountFilter, vendorFilter, showProperties, showNonProperties, activeFlag, similarAccountNames])

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
      description: e.description ?? '',
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
      description: form.description || null,
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

  const tableProps = {
    highlightId, editId, confirmDeleteId, deleting, saving, form,
    onEdit: openEdit,
    onCloseEdit: () => { setEditId(null); setConfirmDeleteId(null) },
    onFormChange: setForm,
    onSaveEdit: saveEdit,
    onDeleteStart: (id: number) => setConfirmDeleteId(id),
    onDeleteConfirm: deleteExpense,
    onDeleteCancel: () => setConfirmDeleteId(null),
    colPrefs,
    accounts: accountOptions,
    vendors: vendorOptions,
    accountFilter,
    vendorFilter,
    onAccountFilter: setAccountFilter,
    onVendorFilter: setVendorFilter,
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const flagButtons: { key: 'similar' | 'bundled' | 'no_vendor' | 'properties_no_location'; letter: string; label: string }[] = [
    { key: 'similar', letter: 'S', label: 'Similar Account Names' },
    { key: 'bundled', letter: 'B', label: 'Description Looks Bundled' },
    { key: 'no_vendor', letter: 'V', label: 'No Vendor Name' },
    { key: 'properties_no_location', letter: 'L', label: 'Properties Without Location' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-2 pt-2">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="px-2">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <PageLawsList
              scopeKey="Expenses"
              isItemsLaws={true}
              onChange={lawsPanel.bumpRefresh}
              flags={flagButtons.map(({ key, label }) => ({
                key, label, count: flagCounts[key],
                onViewClick: () => setActiveFlag(f => f === key ? null : (key as 'similar' | 'bundled' | 'no_vendor' | 'properties_no_location')),
              }))}
              openForm={lawsPanel.openForm}
              setOpenForm={lawsPanel.setOpenForm}
              hideZeroFlags={lawsPanel.hideZeroFlags}
              setHideZeroFlags={lawsPanel.setHideZeroFlags}
              activeFilters={lawsPanel.activeFilters}
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap">
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
        <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
          <input type="checkbox" checked={showProperties} onChange={() => setShowProperties(p => !p)}
            className="w-3 h-3 accent-blue-600" />
          Properties
        </label>
        <label className="flex items-center gap-1 text-[9px] font-semibold text-gray-600 px-1.5 py-0.5 cursor-pointer select-none">
          <input type="checkbox" checked={showNonProperties} onChange={() => setShowNonProperties(p => !p)}
            className="w-3 h-3 accent-blue-600" />
          Non-Properties
        </label>
        <div className="w-px h-3 bg-gray-300 shrink-0" />
        <button onClick={() => setShowHistory(h => !h)}
          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
            ${showHistory ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          History
        </button>
        <span className="ml-auto text-[9px] text-gray-400">{filtered.length} records</span>
        <ColumnsPickerButton prefs={colPrefs} />
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
