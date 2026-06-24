'use client'
import { useState, useEffect, useMemo } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Expense = {
  id: number
  expense_date: string
  expense_account: string
  cf_justify: string | null
  vendor_name: string | null
  amount: string
  cf_expense_type: string | null
  is_property: boolean
  property_status: string | null
  entered_by: string | null
}

type Tab = 'all' | 'properties' | 'at_shop' | 'away'


function fmtAmt(val: string) {
  const n = parseFloat(val)
  return `₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_LABELS: Record<string, string> = {
  at_shop: 'At Shop',
  not_at_shop: 'Not at Shop',
  spoilt: 'Spoilt',
}

const STATUS_COLORS: Record<string, string> = {
  at_shop: 'bg-green-100 text-green-700',
  not_at_shop: 'bg-orange-100 text-orange-700',
  spoilt: 'bg-red-100 text-red-600',
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

const EMPTY_FORM = {
  expense_date: '',
  expense_account: '',
  cf_justify: '',
  vendor_name: '',
  amount: '',
  cf_expense_type: '',
  is_property: false,
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  // Add / Edit
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = expenses
    if (tab === 'properties') list = list.filter(e => e.is_property)
    if (tab === 'at_shop') list = list.filter(e => e.is_property && e.property_status === 'at_shop')
    if (tab === 'away') list = list.filter(e => e.is_property && (e.property_status === 'not_at_shop' || e.property_status === 'spoilt'))
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.cf_justify ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q) ||
      (e.cf_expense_type ?? '').toLowerCase().includes(q)
    )
  }, [expenses, tab, search])

  function openAdd() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setShowAdd(true)
  }

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
    setShowAdd(true)
  }

  async function saveForm() {
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

    const res = editId
      ? await fetch(`/api/expenses/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

    setSaving(false)
    if (res.ok) {
      const updated: Expense = await res.json()
      setExpenses(prev =>
        editId
          ? prev.map(e => e.id === editId ? { ...e, ...updated } : e)
          : [updated, ...prev]
      )
      setShowAdd(false)
    }
  }

  async function toggleProperty(expense: Expense) {
    const newVal = !expense.is_property
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_property: newVal }),
    })
    if (res.ok) {
      const updated = await res.json()
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, ...updated } : e))
    }
  }

  async function setPropertyStatus(expense: Expense, status: string) {
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_status: status }),
    })
    if (res.ok) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, property_status: status } : e))
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'properties', label: 'Properties' },
    { key: 'at_shop', label: 'At Shop' },
    { key: 'away', label: 'Away / Spoilt' },
  ]

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Expenses</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} of {expenses.length}</p>
        </div>
        <button onClick={openAdd}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New
        </button>
      </div>

      {/* Add / Edit form */}
      {showAdd && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">{editId ? 'Edit Expense' : 'New Expense'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={form.expense_date}
                onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Amount (₵)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Expense Account</label>
            <input value={form.expense_account} placeholder="e.g. Delivery"
              onChange={e => setForm(f => ({ ...f, expense_account: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Justification (cf_justify)</label>
            <input value={form.cf_justify} placeholder="Details..."
              onChange={e => setForm(f => ({ ...f, cf_justify: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Vendor Name</label>
              <input value={form.vendor_name} placeholder="Optional"
                onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Expense Type</label>
              <input value={form.cf_expense_type} placeholder="e.g. Properties Expenses"
                onChange={e => setForm(f => ({ ...f, cf_expense_type: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_property}
              onChange={e => setForm(f => ({ ...f, is_property: e.target.checked }))}
              className="w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-700">This expense is a property</span>
          </label>
          <div className="flex gap-2">
            <button onClick={saveForm} disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition
              ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search account, justification, vendor..."
        className="w-full mb-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base
          text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-10">No expenses found.</p>
        )}
        {filtered.map(expense => (
          <div key={expense.id}
            className="bg-white border border-gray-200 rounded-xl p-3 space-y-2">
            {/* Row 1: date + amount */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{expense.expense_account}</p>
                <p className="text-xs text-gray-400 mt-0.5">{fmtDate(expense.expense_date)}{expense.entered_by ? ` · ${expense.entered_by}` : ''}</p>
              </div>
              <p className="text-sm font-bold text-gray-900 shrink-0">{fmtAmt(expense.amount)}</p>
            </div>

            {/* Row 2: justify + vendor */}
            {(expense.cf_justify || expense.vendor_name) && (
              <div className="text-xs text-gray-500 space-y-0.5">
                {expense.cf_justify && <p>{expense.cf_justify}</p>}
                {expense.vendor_name && <p className="text-gray-400">Vendor: {expense.vendor_name}</p>}
              </div>
            )}

            {/* Row 3: type + property status */}
            <div className="flex items-center gap-2 flex-wrap">
              {expense.cf_expense_type && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {expense.cf_expense_type}
                </span>
              )}
              {expense.is_property && expense.property_status && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[expense.property_status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {STATUS_LABELS[expense.property_status] ?? expense.property_status}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
              <button onClick={() => openEdit(expense)}
                className="text-xs text-blue-600 font-semibold px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                Edit
              </button>

              <button onClick={() => toggleProperty(expense)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition
                  ${expense.is_property
                    ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {expense.is_property ? 'Property ON' : 'Property'}
              </button>

              {/* Property status selector — only shows if is_property */}
              {expense.is_property && (
                <select
                  value={expense.property_status ?? 'at_shop'}
                  onChange={e => setPropertyStatus(expense, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-blue-400">
                  <option value="at_shop">At Shop</option>
                  <option value="not_at_shop">Not at Shop</option>
                  <option value="spoilt">Spoilt</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
