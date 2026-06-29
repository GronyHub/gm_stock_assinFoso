'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'
import HistoryPanel from './HistoryPanel'

type Expense = {
  id: number
  expense_date: string
  expense_account: string
  description: string | null
  cf_justify: string | null
  vendor_name: string | null
  amount: string
  cf_expense_type: string | null
  is_property: boolean
  property_status: string | null
  entered_by: string | null
}

type ExpTab = 'all' | 'properties' | 'at_shop' | 'away'

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string) {
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function fmtTotal(expenses: Expense[]) {
  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
  return total.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const STATUS_COLORS: Record<string, string> = {
  at_shop: 'text-green-600', not_at_shop: 'text-orange-500', spoilt: 'text-red-500',
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const ACCOUNTS = ['Office Expenses','Rent','Utilities','Salaries','Transport','Repairs','Supplies','Other']

const TH = 'text-left px-1 py-1 font-semibold text-gray-700 border border-black'
const TD = 'px-1 py-1 border border-black'

type TableProps = {
  rows: Expense[]
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
}

const EMPTY_FORM = {
  expense_date: '', expense_account: '', cf_justify: '', vendor_name: '',
  amount: '', cf_expense_type: '', is_property: false,
}

function ExpenseTable({ rows, editId, confirmDeleteId, deleting, saving, form, onEdit, onCloseEdit,
  onFormChange, onSaveEdit, onDeleteStart, onDeleteConfirm, onDeleteCancel, onPropertyStatus, hideAccount, hideVendor }: TableProps) {
  return (
    <table className="w-full border-collapse text-[10px] border border-black">
      <thead className="sticky top-0 bg-gray-100 z-10">
        <tr>
          <th className={`${TH} whitespace-nowrap`}>DATE</th>
          {!hideAccount && <th className={TH}>ACCOUNT</th>}
          <th className={TH}>DESCRIPTION</th>
          <th className={TH}>JUSTIFY</th>
          {!hideVendor && <th className={TH}>VENDOR</th>}
          <th className={`${TH} text-right`}>AMT</th>
          <th className={TH}>BY</th>
          <th className="px-1 py-1 border border-black" />
        </tr>
      </thead>
      <tbody>
        {rows.map(e => (
          <>
            <tr key={e.id} className="hover:bg-gray-50">
              <td className={`${TD} text-gray-600 whitespace-nowrap`}>{fmtShort(e.expense_date)}</td>
              {!hideAccount && <td className={`${TD} text-gray-900 font-semibold`}>{e.expense_account}</td>}
              <td className={`${TD} text-gray-700`}>{e.description ?? '—'}</td>
              <td className={`${TD} text-gray-700`}>{e.cf_justify ?? '—'}</td>
              {!hideVendor && <td className={`${TD} text-gray-500`}>{e.vendor_name ?? '—'}</td>}
              <td className={`${TD} text-right font-bold text-gray-900`}>₵{fmt(e.amount)}</td>
              <td className={`${TD} text-blue-500`}>{e.entered_by ?? '—'}</td>
              <td className={TD}>
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => editId === e.id ? onCloseEdit() : onEdit(e)}
                    className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
                    {editId === e.id ? 'Close' : 'Edit'}
                  </button>
                  {confirmDeleteId === e.id ? (
                    <>
                      <button onClick={() => onDeleteConfirm(e.id)} disabled={deleting}
                        className="text-[9px] text-white font-semibold bg-red-600 px-1.5 py-0.5 rounded hover:bg-red-700 disabled:opacity-40">
                        {deleting ? '…' : 'Yes'}
                      </button>
                      <button onClick={onDeleteCancel}
                        className="text-[9px] text-gray-600 font-semibold bg-gray-100 px-1.5 py-0.5 rounded">
                        No
                      </button>
                    </>
                  ) : (
                    <button onClick={() => onDeleteStart(e.id)}
                      className="text-[9px] text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100">
                      Del
                    </button>
                  )}
                </div>
              </td>
            </tr>
            {editId === e.id && (
              <tr key={`edit-${e.id}`} className="bg-blue-50/40 border-b border-blue-200">
                <td colSpan={8 - (hideAccount ? 1 : 0) - (hideVendor ? 1 : 0)} className="px-2 py-2">
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
                      <select value={form.expense_account}
                        onChange={ev => onFormChange({ ...form, expense_account: ev.target.value })} className={inputCls}>
                        {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                      </select>
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
                  <div className="flex gap-1 mt-2">
                    <button onClick={onSaveEdit} disabled={saving}
                      className="bg-green-600 text-white text-[10px] font-bold rounded px-3 py-1 disabled:opacity-40">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={onCloseEdit}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                  </div>
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  )
}

type Props = { search: string }

export default function ExpensesTab({ search }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ExpTab>('all')
  const [groupBy, setGroupBy] = useState<'none' | 'account' | 'vendor'>('none')
  const [showHistory, setShowHistory] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadExpenses() }, [])
  usePolling(loadExpenses, 5000, editId === null)


  const filtered = useMemo(() => {
    let list = expenses
    if (tab === 'properties') list = list.filter(e => e.is_property)
    if (tab === 'at_shop')    list = list.filter(e => e.is_property && e.property_status === 'at_shop')
    if (tab === 'away')       list = list.filter(e => e.is_property && (e.property_status === 'not_at_shop' || e.property_status === 'spoilt'))
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q) ||
      (e.cf_justify ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q)
    )
  }, [expenses, tab, search])

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
    setForm({
      expense_date: e.expense_date?.slice(0, 10) ?? '',
      expense_account: e.expense_account,
      cf_justify: e.cf_justify ?? '',
      vendor_name: e.vendor_name ?? '',
      amount: parseFloat(e.amount).toString(),
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
    editId, confirmDeleteId, deleting, saving, form,
    onEdit: openEdit,
    onCloseEdit: () => setEditId(null),
    onFormChange: setForm,
    onSaveEdit: saveEdit,
    onDeleteStart: (id: number) => { setConfirmDeleteId(id); setEditId(null) },
    onDeleteConfirm: deleteExpense,
    onDeleteCancel: () => setConfirmDeleteId(null),
    onPropertyStatus: setPropertyStatus,
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

      {showHistory && <HistoryPanel keywords={['expense']} />}

      {!showHistory && <div className="flex-1 overflow-y-auto min-h-0">
        {groupBy !== 'none' ? (
          grouped.length === 0
            ? <p className="text-[10px] text-gray-400 text-center py-10">No expenses</p>
            : grouped.map(([label, rows]) => (
              <div key={label} className="mb-4">
                <div className="flex items-center justify-between px-2 py-1 bg-blue-600 sticky top-0 z-20">
                  <p className="text-[10px] font-bold text-white">{label}</p>
                  <p className="text-[9px] text-blue-200">{rows.length} record{rows.length !== 1 ? 's' : ''} · ₵{fmtTotal(rows)}</p>
                </div>
                <ExpenseTable rows={rows} {...tableProps}
                  hideAccount={groupBy === 'account'}
                  hideVendor={groupBy === 'vendor'} />
              </div>
            ))
        ) : (
          <>
            <ExpenseTable rows={filtered} {...tableProps} />
            {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No expenses</p>}
          </>
        )}
      </div>}
    </div>
  )
}
