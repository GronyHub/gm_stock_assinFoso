'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'

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

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string | null) {
  if (!val) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function stBadge(s: string) {
  const l = s.toLowerCase()
  if (l === 'paid') return { label: 'P', cls: 'text-green-600' }
  if (l === 'overdue') return { label: 'OD', cls: 'text-red-600' }
  return { label: 'Op', cls: 'text-orange-500' }
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Bill | null>(null)
  const [lines, setLines] = useState<BillLine[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ bill_date: '', vendor_name: '', status: 'paid' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/bills')
      .then(r => r.json())
      .then(data => { setBills(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return bills
    return bills.filter(b =>
      (b.vendor_name ?? '').toLowerCase().includes(q) ||
      b.bill_number.toLowerCase().includes(q) ||
      b.bill_date.includes(q)
    )
  }, [bills, search])

  async function selectBill(bill: Bill) {
    setSelected(bill); setEditing(false); setLines([]); setLinesLoading(true)
    const res = await fetch(`/api/bills/${bill.id}`)
    setLines(await res.json())
    setLinesLoading(false)
  }

  function startEdit(b: Bill) {
    setEditForm({ bill_date: b.bill_date?.slice(0, 10) ?? '', vendor_name: b.vendor_name ?? '', status: b.status ?? 'paid' })
    setEditing(true)
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/bills/${selected.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill_date: editForm.bill_date || undefined, vendor_name: editForm.vendor_name || null, status: editForm.status }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: Bill = await res.json()
      setBills(prev => prev.map(b => b.id === selected.id ? { ...b, ...updated } : b))
      setSelected(s => s ? { ...s, ...updated } : s)
      setEditing(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-white shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${bills.length} bills…`}
          className="flex-1 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
        <Link href="/bills/new"
          className="shrink-0 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded hover:bg-blue-500">
          + New
        </Link>
      </div>

      <div className="flex flex-1 min-h-0">

        {/* LEFT: bills table */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">DATE</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">VENDOR</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">AMT</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ST</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const st = stBadge(b.status)
                return (
                  <tr key={b.id} onClick={() => selectBill(b)}
                    className={`cursor-pointer border-b border-gray-100 transition ${selected?.id === b.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(b.bill_date)}</td>
                    <td className="px-0.5 py-0.5 text-gray-700 truncate max-w-[70px]">{b.vendor_name ?? '—'}</td>
                    <td className="px-0.5 py-0.5 text-right text-gray-900 font-semibold">{fmt(b.total)}</td>
                    <td className={`px-0.5 py-0.5 text-right font-bold ${st.cls}`}>{st.label}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* RIGHT: detail */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a bill</p>
          ) : editing ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-600">Edit Bill</p>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                <input type="date" value={editForm.bill_date}
                  onChange={e => setEditForm(f => ({ ...f, bill_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Vendor</p>
                <input value={editForm.vendor_name}
                  onChange={e => setEditForm(f => ({ ...f, vendor_name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Status</p>
                <select value={editForm.status}
                  onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                  <option value="paid">Paid</option>
                  <option value="open">Open</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="flex gap-1">
                <button onClick={saveEdit} disabled={saving}
                  className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => setEditing(false)}
                  className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="text-[10px] font-bold text-gray-900">{selected.vendor_name ?? 'Unknown'}</p>
                  <p className="text-[9px] text-gray-400">{fmtShort(selected.bill_date)} · {selected.bill_number}</p>
                </div>
                <button onClick={() => startEdit(selected)}
                  className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
                  Edit
                </button>
              </div>
              {linesLoading ? (
                <p className="text-[10px] text-gray-400 text-center py-6">Loading…</p>
              ) : lines.length === 0 ? (
                <p className="text-[10px] text-gray-400 text-center py-6">No items.</p>
              ) : (
                <table className="w-full border-collapse text-[10px]">
                  <thead className="sticky top-0 bg-gray-100 z-10">
                    <tr>
                      <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">item</th>
                      <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">qty</th>
                      <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">price</th>
                      <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-1.5 py-0.5 text-gray-900">{l.item_name}</td>
                        <td className="px-1.5 py-0.5 text-right text-gray-700">{parseFloat(l.quantity)}</td>
                        <td className="px-1.5 py-0.5 text-right text-gray-700">{fmt(l.unit_price)}</td>
                        <td className="px-1.5 py-0.5 text-right font-semibold text-gray-900">{fmt(l.item_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-1.5 py-1 text-right font-bold text-gray-600">Total</td>
                      <td className="px-1.5 py-1 text-right font-bold text-gray-900">{fmt(selected.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
