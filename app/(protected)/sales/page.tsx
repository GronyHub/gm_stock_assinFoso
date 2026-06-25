'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  const day   = d.getUTCDate()
  const mo    = MONTHS[d.getUTCMonth()]
  const yr    = String(d.getUTCFullYear()).slice(-2)
  const dow   = DAYS[d.getUTCDay()]
  return `${day} ${mo} ${yr}-${dow}`
}

function fmtCust(name: string | null) {
  if (!name) return 'WIC'
  const u = name.toLowerCase()
  if (u.includes('walk') || u.includes('wic')) return 'WIC'
  return 'GMC'
}

type Receipt = {
  id: number
  receipt_number: string
  receipt_date: string
  customer_name: string | null
  invoice_amount: string | null
  cash_counted: string | null
  wnw: string | null
  entered_by: string | null
}

type Line = {
  id: number
  item_name: string
  quantity: string | null
  item_price: string | null
  item_total: string | null
  usage_unit: string | null
}

type EditLine = { id: number; item_name: string; quantity: string; item_price: string }

function n(val: string | null) {
  if (!val) return null
  const v = parseFloat(val)
  return isNaN(v) ? null : v
}

function fmt(val: string | null) {
  const v = n(val)
  if (v === null) return '—'
  return v.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function wnwColor(wnw: string | null) {
  const v = n(wnw)
  if (v === null) return 'text-gray-400'
  if (v > 0) return 'text-orange-600'
  if (v < 0) return 'text-red-600'
  return 'text-green-600'
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 placeholder-gray-400 outline-none focus:ring-1 focus:ring-blue-400'

function SalesPageInner() {
  const searchParams = useSearchParams()
  const autoReceiptId = searchParams.get('receipt')

  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Receipt | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [linesLoading, setLinesLoading] = useState(false)
  const [search, setSearch] = useState('')
  const autoOpened = useRef(false)

  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ receipt_date: '', customer_name: '', cash_counted: '' })
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/sales')
      .then(r => r.json())
      .then(data => { setReceipts(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!autoReceiptId || autoOpened.current || receipts.length === 0) return
    const match = receipts.find(r => r.id === Number(autoReceiptId))
    if (match) { autoOpened.current = true; selectReceipt(match) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoReceiptId, receipts])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return receipts
    return receipts.filter(r =>
      (r.customer_name ?? '').toLowerCase().includes(q) ||
      r.receipt_number.toLowerCase().includes(q) ||
      r.receipt_date.includes(q)
    )
  }, [receipts, search])

  async function selectReceipt(r: Receipt) {
    setSelected(r); setEditing(false); setLines([]); setLinesLoading(true)
    const res = await fetch(`/api/sales/${r.id}`)
    setLines(await res.json())
    setLinesLoading(false)
  }

  function startEdit(r: Receipt) {
    setEditForm({
      receipt_date: r.receipt_date?.slice(0, 10) ?? '',
      customer_name: r.customer_name ?? '',
      cash_counted: r.cash_counted ? parseFloat(r.cash_counted).toString() : '',
    })
    setEditLines(lines.map(l => ({
      id: l.id,
      item_name: l.item_name,
      quantity: l.quantity ? parseFloat(l.quantity).toString() : '1',
      item_price: l.item_price ? parseFloat(l.item_price).toString() : '0',
    })))
    setEditing(true)
  }

  function updateEditLine(idx: number, field: keyof EditLine, val: string) {
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  const editTotal = editLines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.item_price) || 0), 0)

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const headerRes = await fetch(`/api/sales/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_date: editForm.receipt_date || undefined,
        customer_name: editForm.customer_name || null,
        cash_counted: editForm.cash_counted ? parseFloat(editForm.cash_counted) : null,
      }),
    })
    await fetch(`/api/sales/${selected.id}/lines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: editLines }),
    })
    setSaving(false)
    if (headerRes.ok) {
      const updated = await headerRes.json()
      const merged: Receipt = { ...selected, ...updated }
      setSelected(merged)
      setReceipts(prev => prev.map(r => r.id === selected.id ? merged : r))
      const lRes = await fetch(`/api/sales/${selected.id}`)
      setLines(await lRes.json())
      setEditing(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading...</div>

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>

      {/* Top bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-gray-200 bg-white shrink-0">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${receipts.length} receipts…`}
          className="flex-1 text-[10px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
        <Link href="/sales/new"
          className="shrink-0 bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded transition hover:bg-blue-500">
          + New
        </Link>
      </div>

      {/* Split body */}
      <div className="flex flex-1 min-h-0">

        {/* ── LEFT: receipts table ── */}
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200 whitespace-nowrap">DATE</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CST</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">CC</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">INV</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">WNW</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}
                  onClick={() => selectReceipt(r)}
                  className={`cursor-pointer border-b border-gray-100 transition
                    ${selected?.id === r.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(r.receipt_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-700">{fmtCust(r.customer_name)}</td>
                  <td className="px-0.5 py-0.5 text-right text-gray-700">{fmt(r.cash_counted)}</td>
                  <td className="px-0.5 py-0.5 text-right text-gray-900 font-semibold">{fmt(r.invoice_amount)}</td>
                  <td className={`px-0.5 py-0.5 text-right font-semibold ${wnwColor(r.wnw)}`}>{fmt(r.wnw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── RIGHT: items / edit ── */}
        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {!selected ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a receipt</p>
          ) : editing ? (
            <div className="p-2 space-y-2">
              <p className="text-[10px] font-bold text-gray-600">Edit Receipt</p>
              <div className="grid grid-cols-2 gap-1">
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Date</p>
                  <input type="date" value={editForm.receipt_date}
                    onChange={e => setEditForm(f => ({ ...f, receipt_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Customer</p>
                  <input value={editForm.customer_name}
                    onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Walk-in" className={inputCls} />
                </div>
              </div>
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Cash Counted (₵)</p>
                <input type="number" min="0" step="0.01" inputMode="decimal"
                  value={editForm.cash_counted}
                  onChange={e => setEditForm(f => ({ ...f, cash_counted: e.target.value }))}
                  placeholder="0" className={inputCls} />
              </div>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="text-left px-1 py-0.5 font-semibold text-gray-500">Item</th>
                    <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Qty</th>
                    <th className="text-right px-1 py-0.5 font-semibold text-gray-500">SP</th>
                    <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {editLines.map((l, idx) => (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="px-1 py-0.5">
                        <input value={l.item_name} onChange={e => updateEditLine(idx, 'item_name', e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-1 py-0.5">
                        <input type="number" value={l.quantity} onChange={e => updateEditLine(idx, 'quantity', e.target.value)}
                          className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-1 py-0.5">
                        <input type="number" value={l.item_price} onChange={e => updateEditLine(idx, 'item_price', e.target.value)}
                          className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                      </td>
                      <td className="px-1 py-0.5 text-right text-gray-700">
                        {((parseFloat(l.quantity)||0)*(parseFloat(l.item_price)||0)).toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-1 py-0.5 text-right font-bold text-gray-600">Total</td>
                    <td className="px-1 py-0.5 text-right font-bold text-gray-900">{editTotal.toFixed(0)}</td>
                  </tr>
                </tfoot>
              </table>
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
              {/* Receipt header strip */}
              <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b border-gray-200">
                <div>
                  <p className="text-[10px] font-bold text-gray-900">{selected.customer_name ?? 'Walk-in Customer'}</p>
                  <p className="text-[9px] text-gray-400">{fmtDate(selected.receipt_date)} · {selected.receipt_number}</p>
                </div>
                <button onClick={() => startEdit(selected)}
                  className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition">
                  Edit
                </button>
              </div>

              {/* Items table */}
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
                      <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">SP</th>
                      <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        <td className="px-1.5 py-1 text-gray-900">{line.item_name}</td>
                        <td className="px-1.5 py-1 text-right text-gray-700">{line.quantity ? parseFloat(line.quantity) : '—'}</td>
                        <td className="px-1.5 py-1 text-right text-gray-700">{fmt(line.item_price)}</td>
                        <td className="px-1.5 py-1 text-right font-semibold text-gray-900">{fmt(line.item_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={3} className="px-1.5 py-1 text-right font-bold text-gray-600">Total</td>
                      <td className="px-1.5 py-1 text-right font-bold text-gray-900">{fmt(selected.invoice_amount)}</td>
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

export default function SalesPage() {
  return (
    <Suspense fallback={<div className="py-10 text-center text-gray-400 text-sm">Loading…</div>}>
      <SalesPageInner />
    </Suspense>
  )
}
