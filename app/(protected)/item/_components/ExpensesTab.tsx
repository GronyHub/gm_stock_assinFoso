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
  property_type: string | null
  related_item_id: number | null
  availability: string | null
  working: string | null
  location: string | null
  not_working_reason: string | null
  not_available_reason: string | null
  entered_by: string | null
  source: string | null
  source_sheet: string | null
}

type PropertyFields = Pick<Expense, 'availability' | 'working' | 'location' | 'not_working_reason' | 'not_available_reason'>

const PROPERTY_LOCATIONS = Array.from({ length: 10 }, (_, i) => `Grony ${i + 1}`)
const NOT_WORKING_REASONS = ['Faulty - Needs Repair', 'Condemned - Beyond Repairs']
const NOT_AVAILABLE_REASONS = ['Spoilt and thrown away', 'Stolen', "At Grony's House"]

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

// Date, Amt, and Account stay sticky/always-visible (first three columns in properties view).
// These columns are configurable. Vendor also gets force-hidden while grouped by that field.
// Property columns are shown only when viewing properties.
type ColKey = 'date' | 'account' | 'description' | 'vendor' | 'source' | 'by' | 'property_type' | 'availability' | 'working' | 'location' | 'reason'
const EXPENSE_COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'date',         label: 'Date' },
  { key: 'account',      label: 'Account' },
  { key: 'description',  label: 'Description' },
  { key: 'vendor',       label: 'Vendor' },
  { key: 'source',       label: 'Source' },
  { key: 'by',           label: 'By' },
  { key: 'property_type', label: 'Type' },
  { key: 'availability', label: 'Available?' },
  { key: 'working',      label: 'Condition' },
  { key: 'location',     label: 'Location' },
  { key: 'reason',       label: 'Reason' },
]
const EXPENSES_COL_DEFAULTS: Record<string, number> = {
  date: 92, amt: 90, account: 120, description: 160, vendor: 120, source: 90, by: 80,
  property_type: 80, availability: 90, working: 90, location: 100, reason: 120,
}

type TableProps = {
  rows: Expense[]
  highlightId?: number | null
  editId: number | null
  confirmDeleteId: number | null
  deleting: boolean
  saving: boolean
  form: typeof EMPTY_FORM
  saveError: string | null
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
  hidePropertyColumns?: boolean
  accounts: string[]
  vendors: string[]
  accountFilter: string | null
  vendorFilter: string | null
  onAccountFilter: (v: string | null) => void
  onVendorFilter: (v: string | null) => void
  itemsByType: Record<string, Array<{ id: number; name: string }>>
  onFetchItemsForType: (propType: string) => Promise<void>
}

const EMPTY_FORM = {
  expense_date: '', expense_account: '', description: '', vendor_name: '',
  amount: '', cf_expense_type: '', is_property: false, property_type: null as string | null,
  related_item_id: null as number | null,
  availability: null as string | null, working: null as string | null, location: null as string | null,
  not_working_reason: null as string | null, not_available_reason: null as string | null,
}

const PROPERTY_TYPES = ['Printer', 'Computer', 'Banners', 'Seating', 'Tables', 'Lamination']

// Clicking the header opens a dropdown of every distinct value in that
// column -- picking one filters the table down to just that value; "All"
// clears it. The header itself turns blue while a filter is active.
function FilterHeaderCell({ label, options, value, onChange, onResize, onResetWidth, sticky }: {
  label: string; options: string[]; value: string | null; onChange: (v: string | null) => void
  onResize: (deltaPx: number) => void; onResetWidth: () => void; sticky?: boolean
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

  const stickyClass = sticky ? 'sticky left-0 z-20 bg-gray-50' : ''

  return (
    <th className={`${TH} relative overflow-hidden border-r ${stickyClass}`} ref={ref}>
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

function ExpenseTable({ rows, highlightId, editId, confirmDeleteId, deleting, saving, form, saveError, onEdit, onCloseEdit,
  onFormChange, onSaveEdit, onDeleteStart, onDeleteConfirm, onDeleteCancel, colPrefs, hideAccount, hideVendor, hidePropertyColumns,
  accounts, vendors, accountFilter, vendorFilter, onAccountFilter, onVendorFilter, itemsByType, onFetchItemsForType }: TableProps) {
  const propertyColKeys: ColKey[] = ['property_type', 'availability', 'working', 'location', 'reason']
  const visibleKeys = colPrefs.colOrder.filter(k => colPrefs.visibleCols.has(k)
    && !(k === 'account' && hideAccount) && !(k === 'vendor' && hideVendor)
    && !(k === 'account')
    && !(hidePropertyColumns && propertyColKeys.includes(k))
    && !(k === 'date'))

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
    if (key === 'by') return <td key={key} className={`${TD} text-blue-500 truncate`}>{e.entered_by ?? '—'}</td>
    if (key === 'property_type') return <td key={key} className={`${TD} text-gray-600 truncate`}>{e.property_type ?? '—'}</td>
    if (key === 'availability') return <td key={key} className={`${TD} text-gray-600 truncate`}>{e.availability ? (e.availability === 'available' ? '✓ Available' : '✗ Away') : '—'}</td>
    if (key === 'working') return <td key={key} className={`${TD} text-gray-600 truncate`}>{e.working ? (e.working === 'working' ? '✓ Working' : '✗ Not Working') : '—'}</td>
    if (key === 'location') return <td key={key} className={`${TD} text-gray-600 truncate`}>{e.location ?? '—'}</td>
    if (key === 'reason') return <td key={key} className={`${TD} text-gray-600 truncate text-[9px]`}>{e.not_working_reason ?? e.not_available_reason ?? '—'}</td>
    return <td key={key} className={`${TD} text-gray-500`}>—</td>
  }

  const accountWidth = colPrefs.getWidth('account', EXPENSES_COL_DEFAULTS.account)
  const dateWidth = colPrefs.getWidth('date', EXPENSES_COL_DEFAULTS.date)
  const amtWidth = colPrefs.getWidth('amt', EXPENSES_COL_DEFAULTS.amt)
  const tableWidth = accountWidth + dateWidth + amtWidth
    + visibleKeys.reduce((s, k) => s + colPrefs.getWidth(k, EXPENSES_COL_DEFAULTS[k] ?? 100), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
    <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: tableWidth }}>
      <colgroup>
        <col style={{ width: accountWidth }} />
        <col style={{ width: dateWidth }} />
        <col style={{ width: amtWidth }} />
        {visibleKeys.map(k => <col key={k} style={{ width: colPrefs.getWidth(k, EXPENSES_COL_DEFAULTS[k] ?? 100) }} />)}
      </colgroup>
      <thead className="sticky top-0 z-10">
        <tr className="bg-gray-50">
          <FilterHeaderCell
            label="Account"
            options={accounts}
            value={accountFilter}
            onChange={onAccountFilter}
            onResize={d => colPrefs.resizeWidth('account', d, EXPENSES_COL_DEFAULTS.account)}
            onResetWidth={() => colPrefs.resetWidth('account')}
            sticky
          />
          <ResizableTh onResize={d => colPrefs.resizeWidth('date', d, EXPENSES_COL_DEFAULTS.date)} onReset={() => colPrefs.resetWidth('date')}>Date Bought</ResizableTh>
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
              <td className={`${TD} sticky left-0 z-10 text-gray-900 font-semibold truncate border-r bg-inherit`}>{e.expense_account}</td>
              <td className={`${TD} text-gray-600 whitespace-nowrap`}>{fmtShort(e.expense_date)}</td>
              <td className={`${TD} text-right font-bold text-gray-900`}>{e.amount_hidden ? '🔒 Hidden' : `₵${fmt(e.amount)}`}</td>
              {visibleKeys.map(k => bodyCellFor(k, e))}
            </tr>
            {editId === e.id && (
              <tr className="bg-blue-50/40">
                <td colSpan={3 + visibleKeys.length} className="px-3 py-3">
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
                  {form.is_property && (
                    <div className="mt-3 space-y-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <div>
                        <p className="text-[9px] text-gray-400 mb-0.5">Property Type</p>
                        <select value={form.property_type ?? ''} onChange={ev => {
                          const newType = ev.target.value
                          onFormChange({ ...form, property_type: newType, related_item_id: null })
                          if (newType) onFetchItemsForType(newType)
                        }}
                          className={`${inputCls} text-[9px]`}>
                          <option value="">Select…</option>
                          {PROPERTY_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </div>
                      {form.property_type && (
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Related {form.property_type}</p>
                          <select value={form.related_item_id ?? ''} onChange={ev => onFormChange({ ...form, related_item_id: ev.target.value ? parseInt(ev.target.value) : null })}
                            className={`${inputCls} text-[9px]`}>
                            <option value="">Select a {form.property_type}…</option>
                            {(itemsByType[form.property_type] || []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                      )}
                      <div>
                        <p className="text-[9px] text-gray-400 mb-0.5">Availability</p>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`availability-${e.id}`} checked={form.availability === 'available'}
                              onChange={() => onFormChange({ ...form, availability: 'available', working: null, location: null, not_working_reason: null, not_available_reason: null })}
                              className="w-3 h-3 accent-blue-600" />
                            <span className="text-[10px] text-gray-700">Available</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer">
                            <input type="radio" name={`availability-${e.id}`} checked={form.availability === 'not_available'}
                              onChange={() => onFormChange({ ...form, availability: 'not_available', working: null, location: null, not_working_reason: null, not_available_reason: null })}
                              className="w-3 h-3 accent-blue-600" />
                            <span className="text-[10px] text-gray-700">Not Available</span>
                          </label>
                        </div>
                      </div>
                      {form.availability === 'available' && (
                        <>
                          <div>
                            <p className="text-[9px] text-gray-400 mb-0.5">Condition</p>
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`working-${e.id}`} checked={form.working === 'working'}
                                  onChange={() => onFormChange({ ...form, working: 'working', not_working_reason: null })}
                                  className="w-3 h-3 accent-blue-600" />
                                <span className="text-[10px] text-gray-700">Working</span>
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name={`working-${e.id}`} checked={form.working === 'not_working'}
                                  onChange={() => onFormChange({ ...form, working: 'not_working' })}
                                  className="w-3 h-3 accent-blue-600" />
                                <span className="text-[10px] text-gray-700">Not Working</span>
                              </label>
                            </div>
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-400 mb-0.5">Location</p>
                            <select value={form.location ?? ''} onChange={ev => onFormChange({ ...form, location: ev.target.value })}
                              className={`${inputCls} text-[9px]`}>
                              <option value="">Select…</option>
                              {PROPERTY_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                          </div>
                          {form.working === 'not_working' && (
                            <div>
                              <p className="text-[9px] text-gray-400 mb-0.5">Reason</p>
                              <select value={form.not_working_reason ?? ''} onChange={ev => onFormChange({ ...form, not_working_reason: ev.target.value })}
                                className={`${inputCls} text-[9px]`}>
                                <option value="">Select…</option>
                                {NOT_WORKING_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                          )}
                        </>
                      )}
                      {form.availability === 'not_available' && (
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Reason / Location</p>
                          <select value={form.not_available_reason ?? ''} onChange={ev => onFormChange({ ...form, not_available_reason: ev.target.value })}
                            className={`${inputCls} text-[9px]`}>
                            <option value="">Select…</option>
                            {NOT_AVAILABLE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                  {saveError && (
                    <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-[9px]">
                      {saveError}
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

type Props = { search: string; onFlagCountChange?: (n: number) => void }

type PropTab = 'all' | 'available' | 'away'

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
  const [saveError, setSaveError] = useState<string | null>(null)
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
  const [propertyAvailabilityFilter, setPropertyAvailabilityFilter] = useState<'all' | 'available' | 'not_available'>('all')
  const [propertyTypeFilter, setPropertyTypeFilter] = useState<string | null>(null)
  const [customViewNames, setCustomViewNames] = useState<Record<string, string>>({})
  const [itemsByType, setItemsByType] = useState<Record<string, { id: number; name: string }[]>>({})

  // Create a unique key for column preferences based on the current view/flag
  const getPrefsKey = () => {
    if (activeFlag) return `expensesTable_flag_${activeFlag}`
    if (groupBy !== 'none') return `expensesTable_groupBy_${groupBy}`
    if (propertyAvailabilityFilter !== 'all') return `expensesTable_propFilter_${propertyAvailabilityFilter}`
    if (propertyTypeFilter) return `expensesTable_propType_${propertyTypeFilter}`
    if (showProperties && !showNonProperties) return 'expensesTable_propertiesOnly'
    if (!showProperties && showNonProperties) return 'expensesTable_nonPropertiesOnly'
    return 'expensesTable_all'
  }

  const colPrefs = useColumnPrefs<ColKey>(getPrefsKey(), EXPENSE_COLUMNS)

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  function saveCustomViewName(viewKey: string, customLabel: string) {
    setCustomViewNames(prev => ({ ...prev, [viewKey]: customLabel }))
    fetch('/api/rename-view', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ viewKey, customLabel }),
    }).catch(() => {})
  }

  useEffect(() => {
    loadExpenses()
    fetch('/api/rename-view')
      .then(r => r.ok ? r.json() : {})
      .then(d => setCustomViewNames(d))
      .catch(() => {})
  }, [])
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

  const viewCounts = useMemo(() => ({
    all_expenses: expenses.length,
    by_account: expenses.length,
    by_vendor: expenses.length,
    show_properties: expenses.filter(e => e.is_property).length,
    show_non_properties: expenses.filter(e => !e.is_property).length,
    prop_available: expenses.filter(e => e.is_property && e.availability === 'available').length,
    prop_not_available: expenses.filter(e => e.is_property && e.availability === 'not_available').length,
    printers: expenses.filter(e => e.is_property && e.property_type === 'Printer').length,
    computers: expenses.filter(e => e.is_property && e.property_type === 'Computer').length,
  }), [expenses])

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
    if (propertyAvailabilityFilter === 'available') list = list.filter(e => e.is_property && e.availability === 'available')
    else if (propertyAvailabilityFilter === 'not_available') list = list.filter(e => e.is_property && e.availability === 'not_available')
    if (propertyTypeFilter) list = list.filter(e => e.is_property && e.property_type === propertyTypeFilter)
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q)
    )
  }, [expenses, search, accountFilter, vendorFilter, showProperties, showNonProperties, propertyAvailabilityFilter, propertyTypeFilter, activeFlag, similarAccountNames])

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

  const properties = useMemo(() => expenses.filter(e => e.is_property), [expenses])
  const propertiesWithoutLocation = useMemo(() =>
    properties.filter(p => p.availability === 'available' && !p.location),
    [properties]
  )

  async function fetchItemsForType(propType: string) {
    if (!propType || !itemsByType[propType]) {
      try {
        const res = await fetch(`/api/items/by-type?type=${encodeURIComponent(propType)}`)
        if (res.ok) {
          const items = await res.json()
          setItemsByType(prev => ({ ...prev, [propType]: items }))
        }
      } catch (e) {
        console.error('Failed to fetch items for type:', e)
      }
    }
  }

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
      property_type: e.property_type ?? null,
      related_item_id: e.related_item_id ?? null,
      availability: e.availability ?? null,
      working: e.working ?? null,
      location: e.location ?? null,
      not_working_reason: e.not_working_reason ?? null,
      not_available_reason: e.not_available_reason ?? null,
    })
    if (e.property_type) {
      fetchItemsForType(e.property_type)
    }
    setEditId(e.id)
    setConfirmDeleteId(null)
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    setSaveError(null)
    const body = {
      expense_date: form.expense_date || undefined,
      expense_account: form.expense_account,
      description: form.description || null,
      vendor_name: form.vendor_name || null,
      amount: parseFloat(form.amount),
      cf_expense_type: form.cf_expense_type || null,
      is_property: form.is_property,
      propertyType: form.property_type || null,
      relatedItemId: form.related_item_id || null,
      availability: form.availability || null,
      working: form.working || null,
      location: form.location || null,
      notWorkingReason: form.not_working_reason || null,
      notAvailableReason: form.not_available_reason || null,
    }
    console.log('Saving expense:', body)
    const res = await fetch(`/api/expenses/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    console.log('Save response status:', res.status)
    if (res.ok) {
      const updated: Expense = await res.json()
      console.log('Updated expense:', updated)
      setExpenses(prev => prev.map(e => e.id === editId ? { ...e, ...updated } : e))
      setEditId(null)
      setSaveError(null)
    } else {
      const error = await res.text()
      console.error('Save error:', error)
      setSaveError(`Save failed: ${res.status} ${error || res.statusText}`)
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
    highlightId, editId, confirmDeleteId, deleting, saving, form, saveError,
    onEdit: openEdit,
    onCloseEdit: () => { setEditId(null); setConfirmDeleteId(null); setSaveError(null) },
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
    itemsByType,
    onFetchItemsForType: fetchItemsForType,
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const flagButtons: { key: 'similar' | 'bundled' | 'no_vendor' | 'properties_no_location'; letter: string; label: string; description: string }[] = [
    { key: 'similar', letter: 'S', label: 'Similar Account Names', description: 'Account names that are close variations of each other (e.g., "Office Expense" vs "Office Expenses") — likely duplicates entered different ways.' },
    { key: 'bundled', letter: 'B', label: 'Description Looks Bundled', description: 'Expense descriptions mentioning multiple items (commas, "&", "and", "etc") — suggests several purchases lumped into one line instead of separate rows.' },
    { key: 'no_vendor', letter: 'V', label: 'No Vendor Name', description: 'Expenses missing a vendor name — helps identify incomplete expense records that need follow-up.' },
    { key: 'properties_no_location', letter: 'L', label: 'Properties Without Location', description: 'Available properties that have not been assigned a storage location — need to be placed at a Grony location.' },
  ]

  const isAllExpenses = activeFlag === null && propertyAvailabilityFilter === 'all' && groupBy === 'none' && showProperties && showNonProperties && !propertyTypeFilter

  const getActiveViewHeading = () => {
    if (activeFlag === 'similar') return 'Similar Account Names'
    if (activeFlag === 'bundled') return 'Description Looks Bundled'
    if (activeFlag === 'no_vendor') return 'No Vendor Name'
    if (activeFlag === 'properties_no_location') return 'Properties Without Location'
    if (propertyTypeFilter === 'Printer') return 'Printers'
    if (propertyTypeFilter === 'Computer') return 'Computers'
    if (groupBy === 'account') return 'Grouped by Account'
    if (groupBy === 'vendor') return 'Grouped by Vendor'
    if (propertyAvailabilityFilter === 'available') return 'Properties Available'
    if (propertyAvailabilityFilter === 'not_available') return 'Properties Not Available'
    if (!showProperties && showNonProperties) return 'Non-Properties Only'
    if (showProperties && !showNonProperties) return 'Properties Only'
    if (isAllExpenses) return 'All Expenses'
    return null
  }

  const activeViewHeading = getActiveViewHeading()

  const viewButtons: { key: string; letter: string; label: string; description: string; active: boolean; count: number; onChange: () => void }[] = [
    { key: 'all_expenses', letter: '∑', label: 'All Expenses', description: 'View all expenses without any filters or grouping — returns to the default view.', active: isAllExpenses, count: viewCounts.all_expenses, onChange: () => { setActiveFlag(null); setPropertyAvailabilityFilter('all'); setGroupBy('none'); setShowProperties(true); setShowNonProperties(true); setPropertyTypeFilter(null) } },
    { key: 'by_account', letter: 'A', label: 'By Account', description: 'Group expenses by their account category to see totals and records for each account.', active: groupBy === 'account', count: viewCounts.by_account, onChange: () => { setActiveFlag(null); setGroupBy(g => g === 'account' ? 'none' : 'account') } },
    { key: 'by_vendor', letter: 'V', label: 'By Vendor', description: 'Group expenses by vendor to see total spending and records for each supplier.', active: groupBy === 'vendor', count: viewCounts.by_vendor, onChange: () => { setActiveFlag(null); setGroupBy(g => g === 'vendor' ? 'none' : 'vendor') } },
    { key: 'show_properties', letter: 'P', label: 'All Properties', description: 'View only expenses marked as properties/equipment.', active: showProperties && !showNonProperties, count: viewCounts.show_properties, onChange: () => { setActiveFlag(null); setPropertyAvailabilityFilter('all'); setPropertyTypeFilter(null); setShowProperties(true); setShowNonProperties(false) } },
    { key: 'show_non_properties', letter: 'N', label: 'Non-Properties', description: 'View only regular expenses (non-property expenditures).', active: !showProperties && showNonProperties, count: viewCounts.show_non_properties, onChange: () => { setActiveFlag(null); setShowProperties(false); setShowNonProperties(true) } },
    { key: 'prop_available', letter: 'A', label: 'Properties Available', description: 'View only properties currently at a Grony shop location (marked as available).', active: propertyAvailabilityFilter === 'available', count: viewCounts.prop_available, onChange: () => { setActiveFlag(null); setPropertyTypeFilter(null); setPropertyAvailabilityFilter('available') } },
    { key: 'prop_not_available', letter: 'U', label: 'Properties Not Available', description: 'View only properties that are currently away from shop (spoilt, stolen, or at Grony\'s house).', active: propertyAvailabilityFilter === 'not_available', count: viewCounts.prop_not_available, onChange: () => { setActiveFlag(null); setPropertyTypeFilter(null); setPropertyAvailabilityFilter('not_available') } },
    { key: 'printers', letter: 'M', label: 'Printers', description: 'View only printers and printer-related expenses.', active: propertyTypeFilter === 'Printer', count: viewCounts.printers, onChange: () => { setActiveFlag(null); setPropertyAvailabilityFilter('all'); setPropertyTypeFilter('Printer') } },
    { key: 'computers', letter: 'C', label: 'Computers', description: 'View only computers and computer-related expenses.', active: propertyTypeFilter === 'Computer', count: viewCounts.computers, onChange: () => { setActiveFlag(null); setPropertyAvailabilityFilter('all'); setPropertyTypeFilter('Computer') } },
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
        <div className="px-2 min-h-0 max-h-[40vh] overflow-y-auto border border-gray-200 rounded-xl bg-white">
            <PageLawsList
              scopeKey="Expenses"
              isItemsLaws={true}
              onChange={lawsPanel.bumpRefresh}
              flags={[
                ...flagButtons.map(({ key, label, description }) => ({
                  key, label, description, count: flagCounts[key],
                  onViewClick: () => setActiveFlag(f => f === key ? null : (key as 'similar' | 'bundled' | 'no_vendor' | 'properties_no_location')),
                })),
                ...viewButtons.map(({ key, label, description, count, onChange }) => ({
                  key, label, description, count,
                  onViewClick: onChange,
                })),
              ]}
              customViewNames={customViewNames}
              onSaveViewName={saveCustomViewName}
              openForm={lawsPanel.openForm}
              setOpenForm={lawsPanel.setOpenForm}
              hideZeroFlags={lawsPanel.hideZeroFlags}
              setHideZeroFlags={lawsPanel.setHideZeroFlags}
              activeFilters={lawsPanel.activeFilters}
            />
        </div>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap">
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

      {!showHistory && <div className="flex-1 overflow-y-auto min-h-0 p-2 flex flex-col">
        {activeViewHeading && (
          <div className="px-3 py-2 mb-2 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700">Showing: {activeViewHeading}</p>
          </div>
        )}
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
                      hideVendor={groupBy === 'vendor'}
                      hidePropertyColumns={showNonProperties} />
                  </div>
                </div>
              ))}
            </div>
        ) : (
          <>
            <ExpenseTable rows={filtered} {...tableProps} hidePropertyColumns={showNonProperties} />
            {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-10">No expenses</p>}
          </>
        )}
      </div>}
    </div>
  )
}
