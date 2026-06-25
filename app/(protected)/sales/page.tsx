'use client'
import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { fmtDate } from '@/lib/fmtDate'

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

function fmtAmt(val: string | null) {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  if (isNaN(n)) return '—'
  return `₵${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function wnwColor(wnw: string | null) {
  if (!wnw) return 'text-gray-400'
  const n = parseFloat(wnw)
  if (n > 0) return 'text-orange-600 font-semibold'
  if (n < 0) return 'text-red-600 font-semibold'
  return 'text-green-600 font-semibold'
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

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

  // Auto-open receipt when arriving from a flag link (?receipt=ID)
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
    // Save header
    const headerRes = await fetch(`/api/sales/${selected.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receipt_date: editForm.receipt_date || undefined,
        customer_name: editForm.customer_name || null,
        cash_counted: editForm.cash_counted ? parseFloat(editForm.cash_counted) : null,
      }),
    })
    // Save lines
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
      // Refresh lines
      const lRes = await fetch(`/api/sales/${selected.id}`)
      setLines(await lRes.json())
      setEditing(false)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400">Loading...</div>

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Sales Receipts</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} of {receipts.length} receipts</p>
        </div>
        <Link href="/sales/new" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition">
          + New
        </Link>
      </div>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by customer, receipt no, or date..."
        className="w-full mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />

      <div className="md:flex md:gap-4 md:h-[calc(100vh-200px)]">
        {/* Left list */}
        <div className={`md:w-2/5 md:overflow-y-auto space-y-2 ${selected ? 'hidden md:block' : 'block'}`}>
          {filtered.map(r => (
            <button key={r.id} onClick={() => selectReceipt(r)}
              className={`w-full text-left rounded-xl border p-3 transition
                ${selected?.id === r.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{r.customer_name ?? 'Walk-in Customer'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmtDate(r.receipt_date)}{r.entered_by ? ` · ${r.entered_by}` : ''}</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-sm font-bold text-gray-900">{fmtAmt(r.invoice_amount)}</p>
                  {r.cash_counted && <p className="text-xs text-gray-400">Cash: {fmtAmt(r.cash_counted)}</p>}
                  {r.wnw !== null && <p className={`text-xs ${wnwColor(r.wnw)}`}>WNW: {fmtAmt(r.wnw)}</p>}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Right detail */}
        {selected && (
          <div className="md:flex-1 md:overflow-y-auto">
            <button onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-blue-600 text-sm font-medium mb-3">
              &larr; Back
            </button>

            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              {editing ? (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-900">Edit Receipt</p>

                  {/* Header fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Date</label>
                      <input type="date" value={editForm.receipt_date}
                        onChange={e => setEditForm(f => ({ ...f, receipt_date: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Customer</label>
                      <input value={editForm.customer_name}
                        onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))}
                        placeholder="Walk-in Customer" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Cash Counted (₵)</label>
                    <input type="number" min="0" step="0.01" inputMode="decimal"
                      value={editForm.cash_counted}
                      onChange={e => setEditForm(f => ({ ...f, cash_counted: e.target.value }))}
                      placeholder="0.00" className={inputCls} />
                  </div>

                  {/* Line items */}
                  <div>
                    <label className={labelCls}>Line Items</label>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="grid grid-cols-[1fr_70px_80px_70px] gap-1 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                        <span>Item</span><span className="text-right">Qty</span><span className="text-right">Price</span><span className="text-right">Total</span>
                      </div>
                      {editLines.map((l, idx) => (
                        <div key={l.id} className="grid grid-cols-[1fr_70px_80px_70px] gap-1 px-3 py-2 border-b border-gray-100 last:border-0 items-center">
                          <input value={l.item_name} onChange={e => updateEditLine(idx, 'item_name', e.target.value)}
                            className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                          <input type="number" min="0" step="any" inputMode="decimal" value={l.quantity}
                            onChange={e => updateEditLine(idx, 'quantity', e.target.value)}
                            className="text-sm text-right text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                          <input type="number" min="0" step="0.01" inputMode="decimal" value={l.item_price}
                            onChange={e => updateEditLine(idx, 'item_price', e.target.value)}
                            className="text-sm text-right text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 w-full" />
                          <p className="text-sm text-right font-medium text-gray-900">
                            ₵{((parseFloat(l.quantity)||0)*(parseFloat(l.item_price)||0)).toFixed(2)}
                          </p>
                        </div>
                      ))}
                      <div className="flex justify-between px-3 py-2 border-t border-gray-200 bg-gray-50">
                        <span className="text-xs font-semibold text-gray-500">Total</span>
                        <span className="text-sm font-bold text-gray-900">₵{editTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* WNW preview */}
                  {editForm.cash_counted && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-gray-400">WNW (auto-calculated)</p>
                      <p className={`font-semibold ${wnwColor(String(parseFloat(editForm.cash_counted) - editTotal))}`}>
                        ₵{(parseFloat(editForm.cash_counted) - editTotal).toFixed(2)}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={saveEdit} disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-3 transition">
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditing(false)} className="px-4 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{selected.customer_name ?? 'Walk-in Customer'}</p>
                      <p className="text-sm text-gray-400">{fmtDate(selected.receipt_date)} &middot; {selected.receipt_number}{selected.entered_by ? ` · ${selected.entered_by}` : ''}</p>
                    </div>
                    <button onClick={() => startEdit(selected)}
                      className="shrink-0 text-xs text-blue-600 font-semibold px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition">
                      Edit
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-slate-50 rounded-xl p-3">
                    <div><p className="text-xs text-gray-400">Invoice</p><p className="text-sm font-bold text-gray-900">{fmtAmt(selected.invoice_amount)}</p></div>
                    <div><p className="text-xs text-gray-400">Cash Counted</p><p className="text-sm font-bold text-gray-900">{fmtAmt(selected.cash_counted)}</p></div>
                    <div><p className="text-xs text-gray-400">WNW</p><p className={`text-sm ${wnwColor(selected.wnw)}`}>{fmtAmt(selected.wnw)}</p></div>
                  </div>
                </>
              )}

              {!editing && (
                <>
                  <div className="border-t border-gray-100" />
                  {linesLoading ? (
                    <p className="text-center text-gray-400 py-6">Loading...</p>
                  ) : lines.length === 0 ? (
                    <p className="text-center text-gray-400 py-6">No line items.</p>
                  ) : (
                    <>
                      <div className="md:hidden space-y-2">
                        {lines.map((line, i) => (
                          <div key={i} className="bg-slate-50 rounded-xl p-3">
                            <p className="text-sm font-semibold text-gray-900">{line.item_name}</p>
                            <div className="grid grid-cols-3 gap-2 text-xs mt-1.5">
                              <div><p className="text-gray-400">Qty</p><p className="text-gray-900 font-medium">{line.quantity ? parseFloat(line.quantity) : '—'}{line.usage_unit ? ` ${line.usage_unit}` : ''}</p></div>
                              <div><p className="text-gray-400">Price</p><p className="text-gray-900 font-medium">{fmtAmt(line.item_price)}</p></div>
                              <div><p className="text-gray-400">Total</p><p className="text-gray-900 font-semibold">{fmtAmt(line.item_total)}</p></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                              <th className="pb-2 font-medium">Item</th>
                              <th className="pb-2 font-medium text-right">Qty</th>
                              <th className="pb-2 font-medium text-right">Price</th>
                              <th className="pb-2 font-medium text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {lines.map((line, i) => (
                              <tr key={i}>
                                <td className="py-2 text-gray-900">{line.item_name}</td>
                                <td className="py-2 text-right text-gray-600">{line.quantity ? parseFloat(line.quantity) : '—'}{line.usage_unit ? ` ${line.usage_unit}` : ''}</td>
                                <td className="py-2 text-right text-gray-600">{fmtAmt(line.item_price)}</td>
                                <td className="py-2 text-right font-semibold text-gray-900">{fmtAmt(line.item_total)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-200">
                              <td colSpan={3} className="pt-3 text-sm font-semibold text-gray-600 text-right">Total</td>
                              <td className="pt-3 text-right font-bold text-gray-900">{fmtAmt(selected.invoice_amount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
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
