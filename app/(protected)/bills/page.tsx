'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'

type Bill = {
  id: number
  bill_number: string
  bill_date: string
  vendor_name: string | null
  total: string
  status: string
  entered_by: string | null
}

type BillLine = {
  item_name: string
  quantity: string
  unit_price: string
  item_total: string
  usage_unit: string | null
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? val : `₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function statusBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid') return 'bg-green-100 text-green-700'
  if (s === 'overdue') return 'bg-red-100 text-red-600'
  return 'bg-orange-100 text-orange-600'
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [lines, setLines] = useState<BillLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)

  // Filters
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [vendorSearch, setVendorSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')

  // Edit
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '', status: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/bills')
      .then(r => r.json())
      .then(data => { setBills(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Item search: filter bills whose lines contain matching item name
  const [itemMatchIds, setItemMatchIds] = useState<Set<number> | null>(null)
  useEffect(() => {
    if (!itemSearch.trim()) { setItemMatchIds(null); return }
    const q = itemSearch.toLowerCase()
    // Search through already-loaded lines if selected, otherwise fetch all lazily
    // Simple approach: filter bills that have been loaded; mark others as potential
    setItemMatchIds(null) // reset to show all while typing
    const timer = setTimeout(async () => {
      // We don't have all lines in memory; use a lightweight search approach:
      // fetch each bill's lines only if not already known — instead use a dedicated endpoint
      // For now, filter on vendor as proxy; a real item search needs all lines loaded
      // Load lines for all bills matching other filters to find item matches
      const q2 = itemSearch.toLowerCase()
      const candidates = bills.filter(b => {
        if (dateFrom && b.bill_date < dateFrom) return false
        if (dateTo && b.bill_date > dateTo) return false
        if (vendorSearch && !(b.vendor_name ?? '').toLowerCase().includes(vendorSearch.toLowerCase())) return false
        return true
      })
      const results = await Promise.all(
        candidates.map(b =>
          fetch(`/api/bills/${b.id}`)
            .then(r => r.json())
            .then((ls: BillLine[]) => ls.some(l => l.item_name.toLowerCase().includes(q2)) ? b.id : null)
            .catch(() => null)
        )
      )
      setItemMatchIds(new Set(results.filter((x): x is number => x !== null)))
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemSearch, bills])

  const filtered = useMemo(() => {
    let list = bills
    if (dateFrom) list = list.filter(b => b.bill_date >= dateFrom)
    if (dateTo)   list = list.filter(b => b.bill_date <= dateTo)
    if (vendorSearch) {
      const q = vendorSearch.toLowerCase()
      list = list.filter(b => (b.vendor_name ?? '').toLowerCase().includes(q))
    }
    if (itemSearch.trim() && itemMatchIds !== null) {
      list = list.filter(b => itemMatchIds.has(b.id))
    }
    return list
  }, [bills, dateFrom, dateTo, vendorSearch, itemSearch, itemMatchIds])

  async function selectBill(bill: Bill) {
    setSelected(bill)
    setEditId(null)
    setLines([])
    setLinesLoading(true)
    const res = await fetch(`/api/bills/${bill.id}`)
    const data = await res.json()
    setLines(data)
    setLinesLoading(false)
  }

  function openEdit(bill: Bill) {
    setEditId(bill.id)
    setEditForm({
      bill_date: bill.bill_date?.slice(0, 10) ?? '',
      vendor_name: bill.vendor_name ?? '',
      status: bill.status ?? 'paid',
    })
  }

  async function saveEdit() {
    if (!editId) return
    setSaving(true)
    const res = await fetch(`/api/bills/${editId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bill_date: editForm.bill_date || undefined,
        vendor_name: editForm.vendor_name || null,
        status: editForm.status || undefined,
      }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: Bill = await res.json()
      setBills(prev => prev.map(b => b.id === editId ? { ...b, ...updated } : b))
      if (selected?.id === editId) setSelected(s => s ? { ...s, ...updated } : s)
      setEditId(null)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Bills</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} of {bills.length}</p>
        </div>
        <Link href="/bills/new"
          className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New Bill
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Vendor</label>
          <input value={vendorSearch} onChange={e => setVendorSearch(e.target.value)}
            placeholder="Search vendor name…" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Item</label>
          <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
            placeholder="Search item in bill lines…" className={inputCls} />
        </div>
        {(dateFrom || dateTo || vendorSearch || itemSearch) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setVendorSearch(''); setItemSearch(''); setItemMatchIds(null) }}
            className="text-xs text-red-500 font-semibold">
            Clear filters
          </button>
        )}
      </div>

      <div className="md:flex md:gap-4 md:h-[calc(100vh-280px)]">

        {/* Left: Bills list */}
        <div className={`md:w-2/5 md:overflow-y-auto space-y-2 ${selected ? 'hidden md:block' : 'block'}`}>
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-10">No bills found.</p>
          )}
          {filtered.map(bill => (
            <button
              key={bill.id}
              onClick={() => selectBill(bill)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${selected?.id === bill.id
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {bill.vendor_name ?? 'Unknown vendor'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(bill.bill_date)}{bill.entered_by ? ` · ${bill.entered_by}` : ''}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900">{fmt(bill.total)}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge(bill.status)}`}>
                    {bill.status}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right: Bill detail */}
        {selected && (
          <div className="md:flex-1 md:overflow-y-auto">
            <button
              onClick={() => setSelected(null)}
              className="md:hidden flex items-center gap-1 text-blue-600 text-sm font-medium mb-3">
              ← Back to bills
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              {/* Bill header */}
              {editId === selected.id ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Edit Bill</p>
                  <div>
                    <label className={labelCls}>Date</label>
                    <input type="date" value={editForm.bill_date}
                      onChange={e => setEditForm(f => ({ ...f, bill_date: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Vendor Name</label>
                    <input value={editForm.vendor_name}
                      onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select value={editForm.status}
                      onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                      className={inputCls}>
                      <option value="paid">Paid</option>
                      <option value="open">Open</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold text-gray-900">{selected.vendor_name ?? 'Unknown vendor'}</p>
                    <p className="text-sm text-gray-400">{fmtDate(selected.bill_date)} · {selected.bill_number}{selected.entered_by ? ` · ${selected.entered_by}` : ''}</p>
                    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(selected.status)}`}>
                      {selected.status}
                    </span>
                  </div>
                  <button onClick={() => openEdit(selected)}
                    className="shrink-0 text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                    Edit
                  </button>
                </div>
              )}

              <div className="border-t border-gray-100" />

              {/* Lines */}
              {linesLoading ? (
                <p className="text-center text-gray-400 py-6">Loading…</p>
              ) : lines.length === 0 ? (
                <p className="text-center text-gray-400 py-6">No line items found.</p>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="md:hidden space-y-3">
                    {lines.map((line, i) => (
                      <div key={i} className="bg-slate-50 rounded-xl p-3 space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{line.item_name}</p>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                          <div>
                            <p className="text-gray-400">Qty</p>
                            <p className="text-gray-900 font-medium">{parseFloat(line.quantity)}{line.usage_unit ? ` ${line.usage_unit}` : ''}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Unit Price</p>
                            <p className="text-gray-900 font-medium">{fmt(line.unit_price)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Total</p>
                            <p className="text-gray-900 font-semibold">{fmt(line.item_total)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                          <th className="pb-2 font-medium">Item</th>
                          <th className="pb-2 font-medium text-right">Qty</th>
                          <th className="pb-2 font-medium text-right">Unit Price</th>
                          <th className="pb-2 font-medium text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {lines.map((line, i) => (
                          <tr key={i}>
                            <td className="py-2 text-gray-900">{line.item_name}</td>
                            <td className="py-2 text-right text-gray-600">{parseFloat(line.quantity)}{line.usage_unit ? ` ${line.usage_unit}` : ''}</td>
                            <td className="py-2 text-right text-gray-600">{fmt(line.unit_price)}</td>
                            <td className="py-2 text-right font-semibold text-gray-900">{fmt(line.item_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200">
                          <td colSpan={3} className="pt-3 text-sm font-semibold text-gray-600 text-right">Total</td>
                          <td className="pt-3 text-right font-bold text-gray-900">{fmt(selected.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Mobile total */}
                  <div className="md:hidden flex justify-between items-center pt-2 border-t border-gray-100">
                    <span className="text-sm font-semibold text-gray-600">Total</span>
                    <span className="text-base font-bold text-gray-900">{fmt(selected.total)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
