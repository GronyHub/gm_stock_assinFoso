'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'

type Expense = {
  id: number
  expense_date: string
  expense_account: string
  cf_justify: string | null
  vendor_name: string | null
  amount: string | null
  amount_hidden?: boolean
  cf_expense_type: string | null
  is_property: boolean
  property_status: string | null
  entered_by: string | null
}

type Tab = 'all' | 'properties' | 'at_shop' | 'away'

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

const STATUS_COLORS: Record<string, string> = {
  at_shop: 'text-green-600', not_at_shop: 'text-orange-500', spoilt: 'text-red-500',
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

const EMPTY_FORM = {
  expense_date: '', expense_account: '', cf_justify: '', vendor_name: '',
  amount: '', cf_expense_type: '', is_property: false,
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Expense | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  function loadExpenses() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then(data => { setExpenses(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadExpenses() }, [])
  usePolling(loadExpenses, 5000, editId === null && !showForm)

  const filtered = useMemo(() => {
    let list = expenses
    if (tab === 'properties') list = list.filter(e => e.is_property)
    if (tab === 'at_shop')    list = list.filter(e => e.is_property && e.property_status === 'at_shop')
    if (tab === 'away')       list = list.filter(e => e.is_property && (e.property_status === 'not_at_shop' || e.property_status === 'spoilt'))
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(e =>
      e.expense_account.toLowerCase().includes(q) ||
      (e.cf_justify ?? '').toLowerCase().includes(q) ||
      (e.vendor_name ?? '').toLowerCase().includes(q)
    )
  }, [expenses, tab, search])

  function openAdd() {
    setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true); setSelected(null); setFormError('')
  }

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
    setEditId(e.id); setShowForm(true)
  }

  async function saveForm() {
    setSaving(true); setFormError('')
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
      setExpenses(prev => editId ? prev.map(e => e.id === editId ? { ...e, ...updated } : e) : [updated, ...prev])
      if (editId && selected?.id === editId) setSelected(s => s ? { ...s, ...updated } : s)
      setShowForm(false)
    } else {
      const d = await res.json().catch(() => ({}))
      setFormError(d.error || 'Could not save expense.')
    }
  }

  async function setPropertyStatus(expense: Expense, status: string) {
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ property_status: status }),
    })
    if (res.ok) {
      setExpenses(prev => prev.map(e => e.id === expense.id ? { ...e, property_status: status } : e))
      if (selected?.id === expense.id) setSelected(s => s ? { ...s, property_status: status } : s)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'properties', label: 'Props' },
    { key: 'at_shop', label: 'At Shop' }, { key: 'away', label: 'Away' },
  ]

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-white shrink-0">
        <div className="flex gap-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
                ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`${filtered.length} expenses…`}
          className="flex-1 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={openAdd}
          className="shrink-0 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded hover:bg-blue-500">
          + New
        </button>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* LEFT: expenses table */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ACCOUNT</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">AMT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} onClick={() => { setSelected(e); setShowForm(false) }}
                  className={`cursor-pointer border-b border-gray-100 transition ${selected?.id === e.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(e.expense_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-900 truncate max-w-[80px]">{e.expense_account}</td>
                  <td className="px-0.5 py-0.5 text-right font-semibold text-gray-900">{e.amount_hidden ? '🔒' : fmt(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RIGHT: detail / form */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {showForm ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-600">{editId ? 'Edit' : 'New'} Expense</p>
              {formError && <p className="text-[10px] text-red-500 font-medium">{formError}</p>}
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                  <input type="date" value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Amount (₵)</p>
                  <input type="number" min="0" step="0.01" inputMode="decimal" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Account</p>
                <input value={form.expense_account}
                  onChange={e => setForm(f => ({ ...f, expense_account: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Justification</p>
                <input value={form.cf_justify}
                  onChange={e => setForm(f => ({ ...f, cf_justify: e.target.value }))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Vendor</p>
                  <input value={form.vendor_name}
                    onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Type</p>
                  <input value={form.cf_expense_type}
                    onChange={e => setForm(f => ({ ...f, cf_expense_type: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={form.is_property}
                  onChange={e => setForm(f => ({ ...f, is_property: e.target.checked }))}
                  className="w-3 h-3 accent-blue-600" />
                <span className="text-[10px] text-gray-700">Is property</span>
              </label>
              <div className="flex gap-1">
                <button onClick={saveForm} disabled={saving}
                  className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setShowForm(false)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                  Cancel
                </button>
              </div>
            </div>
          ) : !selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select an expense</p>
          ) : (
            <div className="p-2 space-y-2">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold text-gray-900 leading-snug">{selected.expense_account}</p>
                  <p className="text-[9px] text-gray-400">{fmtShort(selected.expense_date)}</p>
                </div>
                {!selected.amount_hidden && (
                  <button onClick={() => openEdit(selected)}
                    className="shrink-0 text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                    Edit
                  </button>
                )}
              </div>
              <table className="w-full border-collapse text-[10px]">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-0.5 text-gray-400">Amount</td>
                    <td className="py-0.5 text-right font-bold text-gray-900">{selected.amount_hidden ? '🔒 Hidden' : `₵${fmt(selected.amount)}`}</td>
                  </tr>
                  {selected.cf_justify && (
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 text-gray-400">Justify</td>
                      <td className="py-0.5 text-right text-gray-700">{selected.cf_justify}</td>
                    </tr>
                  )}
                  {selected.vendor_name && (
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 text-gray-400">Vendor</td>
                      <td className="py-0.5 text-right text-gray-700">{selected.vendor_name}</td>
                    </tr>
                  )}
                  {selected.cf_expense_type && (
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 text-gray-400">Type</td>
                      <td className="py-0.5 text-right text-gray-700">{selected.cf_expense_type}</td>
                    </tr>
                  )}
                  {selected.entered_by && (
                    <tr className="border-b border-gray-100">
                      <td className="py-0.5 text-gray-400">By</td>
                      <td className="py-0.5 text-right text-blue-500">{selected.entered_by}</td>
                    </tr>
                  )}
                  {selected.is_property && (
                    <tr>
                      <td className="py-0.5 text-gray-400">Property</td>
                      <td className="py-0.5 text-right">
                        <select value={selected.property_status ?? 'at_shop'}
                          onChange={e => setPropertyStatus(selected, e.target.value)}
                          className={`text-[10px] border border-gray-200 rounded px-1 py-0.5 outline-none ${STATUS_COLORS[selected.property_status ?? ''] ?? 'text-gray-600'}`}>
                          <option value="at_shop">At Shop</option>
                          <option value="not_at_shop">Not at Shop</option>
                          <option value="spoilt">Spoilt</option>
                        </select>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
