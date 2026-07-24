'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePolling } from '@/lib/usePolling'

type POLine = {
  id: number
  item_id: number | null
  item_name: string
  qty_ordered: string
  qty_received: string
  unit_price: string
}

type ReceiptLine = {
  bill_id: number
  item_id: number | null
  item_name: string
  quantity: string
  unit_price: string
  item_total: string
}

type Receipt = {
  id: number
  received_date: string
  received_by: string | null
  bill_id: number | null
  bill_number: string | null
  lines: ReceiptLine[]
}

type PO = {
  id: number
  po_number: string
  vendor_id: number | null
  vendor_name: string | null
  order_date: string
  expected_date: string | null
  status: 'draft' | 'sent' | 'cancelled'
  notes: string | null
  created_by: string | null
  created_at: string
  lines: POLine[]
}

type Vendor = { id: number; display_name: string }
type SearchItem = { id: number; name: string; group: string }
type EditLine = { id: number | null; itemId: number | null; itemName: string; qty: string; price: string }

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string | number | null) {
  if (val == null) return '—'
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// Receiving progress is derived from the lines, never stored, so it can
// never drift out of sync with what's actually been received (see the same
// logic server-side in lib/purchaseOrders.ts -- not imported here since
// that module also pulls in the Neon client, which has no place in a
// client bundle).
type ReceivingState = 'not_started' | 'partial' | 'complete'
function receivingState(lines: POLine[]): ReceivingState {
  if (lines.length === 0) return 'not_started'
  const allComplete = lines.every(l => parseFloat(l.qty_received) >= parseFloat(l.qty_ordered) - 0.001)
  if (allComplete) return 'complete'
  const anyStarted = lines.some(l => parseFloat(l.qty_received) > 0.001)
  return anyStarted ? 'partial' : 'not_started'
}

function StatusBadge({ status }: { status: PO['status'] }) {
  const cls = status === 'draft' ? 'bg-gray-100 text-gray-600'
    : status === 'sent' ? 'bg-blue-50 text-blue-600'
    : 'bg-red-50 text-red-500'
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cls}`}>{status.toUpperCase()}</span>
}

function ProgressBadge({ lines }: { lines: POLine[] }) {
  const state = receivingState(lines)
  if (state === 'complete') return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-green-600">RECEIVED</span>
  if (state === 'not_started') return null
  const ordered = lines.reduce((s, l) => s + parseFloat(l.qty_ordered), 0)
  const received = lines.reduce((s, l) => s + parseFloat(l.qty_received), 0)
  return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{fmt(received)}/{fmt(ordered)}</span>
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

type Props = { search: string }

export default function POTab({ search }: Props) {
  const [pos, setPos] = useState<PO[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<(PO & { receipts: Receipt[] }) | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().slice(0, 10))
  const [receiveQtys, setReceiveQtys] = useState<Record<number, string>>({})
  const [receivePrices, setReceivePrices] = useState<Record<number, string>>({})
  const [receiveError, setReceiveError] = useState('')
  // Full edit (vendor/dates/notes/lines) -- only offered for still-draft
  // POs, matching Send/Delete's own draft-only gating. Reuses the same
  // add-item-by-search pattern as the New PO form.
  const [editMode, setEditMode] = useState(false)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [editOrderDate, setEditOrderDate] = useState('')
  const [editExpectedDate, setEditExpectedDate] = useState('')
  const [editVendorId, setEditVendorId] = useState('')
  const [editVendorName, setEditVendorName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editLines, setEditLines] = useState<EditLine[]>([])
  const [editQuery, setEditQuery] = useState('')
  const [editResults, setEditResults] = useState<SearchItem[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState('')

  function loadList() {
    fetch('/api/purchase-orders').then(r => r.json()).then(d => {
      setPos(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadList() }, [])
  usePolling(loadList, 8000, !receiveOpen && !editMode)

  useEffect(() => {
    fetch('/api/vendors').then(r => r.json()).then(d => setVendors(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (editQuery.length < 2) { setEditResults([]); return }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/items/search?q=${encodeURIComponent(editQuery)}`)
      setEditResults(await r.json())
    }, 250)
    return () => clearTimeout(t)
  }, [editQuery])

  function loadDetail(id: number) {
    setDetailLoading(true)
    fetch(`/api/purchase-orders/${id}`).then(r => r.json()).then(d => {
      setDetail(d)
      setDetailLoading(false)
    }).catch(() => setDetailLoading(false))
  }

  function select(po: PO) {
    setSelectedId(po.id)
    setReceiveOpen(false)
    setReceiveError('')
    setEditMode(false)
    loadDetail(po.id)
  }

  function startEdit() {
    if (!detail) return
    setEditOrderDate(detail.order_date.slice(0, 10))
    setEditExpectedDate(detail.expected_date?.slice(0, 10) ?? '')
    setEditVendorId(detail.vendor_id != null ? String(detail.vendor_id) : '')
    setEditVendorName(detail.vendor_id == null ? (detail.vendor_name ?? '') : '')
    setEditNotes(detail.notes ?? '')
    setEditLines(detail.lines.map(l => ({
      id: l.id, itemId: l.item_id, itemName: l.item_name,
      qty: l.qty_ordered, price: l.unit_price,
    })))
    setEditQuery('')
    setEditError('')
    setEditMode(true)
  }

  function addEditLine(item: SearchItem) {
    setEditLines(prev => [...prev, { id: null, itemId: item.id, itemName: item.name, qty: '1', price: '0' }])
    setEditQuery('')
    setEditResults([])
  }
  function removeEditLine(idx: number) {
    setEditLines(prev => prev.filter((_, i) => i !== idx))
  }
  function updateEditLine(idx: number, field: 'qty' | 'price', val: string) {
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }
  const editTotal = editLines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0), 0)

  async function saveEdit() {
    if (!detail) return
    if (editLines.length === 0) { setEditError('Add at least one item.'); return }
    setEditSaving(true)
    setEditError('')
    const res = await fetch(`/api/purchase-orders/${detail.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderDate: editOrderDate, expectedDate: editExpectedDate || null,
        vendorId: editVendorId ? Number(editVendorId) : null, vendorName: editVendorName || null,
        notes: editNotes || null,
        lines: editLines.map(l => ({ itemId: l.itemId, itemName: l.itemName, qty: Number(l.qty) || 0, price: Number(l.price) || 0 })),
      }),
    })
    const d = await res.json().catch(() => ({}))
    setEditSaving(false)
    if (res.ok) {
      setEditMode(false)
      loadDetail(detail.id)
      loadList()
    } else {
      setEditError(d.error || 'Could not save changes. Please try again.')
    }
  }

  const filtered = useMemo(() => {
    if (!search) return pos
    const q = search.toLowerCase()
    return pos.filter(p =>
      (p.vendor_name ?? '').toLowerCase().includes(q) ||
      p.po_number.toLowerCase().includes(q) ||
      p.lines.some(l => l.item_name.toLowerCase().includes(q))
    )
  }, [pos, search])

  async function setStatus(status: 'sent' | 'cancelled') {
    if (!detail) return
    setBusy(true)
    const res = await fetch(`/api/purchase-orders/${detail.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy(false)
    if (res.ok) { loadDetail(detail.id); loadList() }
  }

  async function deleteDraft() {
    if (!detail) return
    if (!confirm(`Delete draft ${detail.po_number}? This cannot be undone.`)) return
    setBusy(true)
    const res = await fetch(`/api/purchase-orders/${detail.id}`, { method: 'DELETE' })
    setBusy(false)
    if (res.ok) { setSelectedId(null); setDetail(null); loadList() }
  }

  function openReceive() {
    if (!detail) return
    const qtys: Record<number, string> = {}
    const prices: Record<number, string> = {}
    for (const l of detail.lines) {
      const remaining = parseFloat(l.qty_ordered) - parseFloat(l.qty_received)
      qtys[l.id] = remaining > 0 ? String(remaining) : '0'
      prices[l.id] = l.unit_price
    }
    setReceiveQtys(qtys)
    setReceivePrices(prices)
    setReceiveDate(new Date().toISOString().slice(0, 10))
    setReceiveError('')
    setReceiveOpen(true)
  }

  async function submitReceive() {
    if (!detail) return
    const lines = detail.lines
      .map(l => ({ poLineId: l.id, qty: Number(receiveQtys[l.id] ?? 0), price: Number(receivePrices[l.id] ?? l.unit_price) }))
      .filter(l => l.qty > 0)
    if (lines.length === 0) { setReceiveError('Enter a quantity for at least one item.'); return }

    setBusy(true)
    setReceiveError('')
    const res = await fetch(`/api/purchase-orders/${detail.id}/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: receiveDate, lines }),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      setReceiveOpen(false)
      loadDetail(detail.id)
      loadList()
    } else {
      setReceiveError(d.error || 'Could not receive items. Please try again.')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <span className="text-[9px] font-semibold text-gray-400">{filtered.length} purchase order{filtered.length !== 1 ? 's' : ''}</span>
        <Link href="/purchase-orders/new"
          className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
          + New PO
        </Link>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-1/2 border-r border-gray-200 overflow-y-auto min-h-0">
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">PO</th>
                <th className="text-left px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">VENDOR</th>
                <th className="text-right px-0.5 py-1 font-semibold text-gray-500 border-b border-gray-200">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} onClick={() => select(p)}
                  className={`cursor-pointer border-b border-gray-100 transition ${selectedId === p.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-0.5 py-0.5 text-gray-700 whitespace-nowrap">{fmtShort(p.order_date)}</td>
                  <td className="px-0.5 py-0.5 text-gray-700 truncate max-w-[70px]">{p.vendor_name ?? '—'}</td>
                  <td className="px-0.5 py-0.5">
                    <div className="flex flex-col items-end gap-0.5">
                      <StatusBadge status={p.status} />
                      {p.status !== 'draft' && p.status !== 'cancelled' && <ProgressBadge lines={p.lines} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No purchase orders</p>}
        </div>

        <div className="w-1/2 overflow-y-auto min-h-0 bg-white">
          {!selectedId ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Select a purchase order</p>
          ) : detailLoading || !detail ? (
            <p className="text-[10px] text-gray-400 text-center py-10">Loading…</p>
          ) : (
            <div>
              <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200 sticky top-0 z-10 space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-900">{detail.vendor_name ?? 'Unknown vendor'}</p>
                    <p className="text-[9px] text-gray-400">{fmtShort(detail.order_date)} · {detail.po_number}</p>
                  </div>
                  <StatusBadge status={detail.status} />
                </div>
                {detail.expected_date && (
                  <p className="text-[9px] text-gray-400">Expected: {fmtShort(detail.expected_date)}</p>
                )}
                {detail.notes && <p className="text-[9px] text-gray-500 italic">{detail.notes}</p>}
                {!editMode && (
                  <div className="flex gap-1 pt-1 flex-wrap">
                    {detail.status === 'draft' && (
                      <>
                        <button onClick={() => setStatus('sent')} disabled={busy}
                          className="text-[9px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded hover:bg-blue-700 disabled:opacity-40">
                          Send
                        </button>
                        <button onClick={startEdit} disabled={busy}
                          className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 disabled:opacity-40">
                          ✏️ Edit
                        </button>
                        <button onClick={deleteDraft} disabled={busy}
                          className="text-[9px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded hover:bg-red-100 disabled:opacity-40">
                          Delete
                        </button>
                      </>
                    )}
                    {detail.status === 'sent' && receivingState(detail.lines) !== 'complete' && (
                      <button onClick={openReceive} disabled={busy}
                        className="text-[9px] font-bold text-white bg-green-600 px-2 py-0.5 rounded hover:bg-green-700 disabled:opacity-40">
                        Receive Items
                      </button>
                    )}
                    {(detail.status === 'draft' || detail.status === 'sent') && receivingState(detail.lines) !== 'complete' && (
                      <button onClick={() => setStatus('cancelled')} disabled={busy}
                        className="text-[9px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200 disabled:opacity-40">
                        Cancel
                      </button>
                    )}
                    <a href={`/purchase-orders/${detail.id}/print`} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded hover:bg-gray-200">
                      🖨️ Print / Download
                    </a>
                  </div>
                )}
              </div>

              {editMode && (
                <div className="p-2 bg-blue-50 border-b border-blue-100 space-y-2">
                  <p className="text-[10px] font-bold text-blue-800">Edit Purchase Order</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <p className="text-[9px] text-gray-500 mb-0.5">Order Date</p>
                      <input type="date" value={editOrderDate} onChange={e => setEditOrderDate(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-500 mb-0.5">Expected Delivery</p>
                      <input type="date" value={editExpectedDate} onChange={e => setEditExpectedDate(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 mb-0.5">Vendor</p>
                    <select value={editVendorId} onChange={e => { setEditVendorId(e.target.value); if (e.target.value) setEditVendorName('') }} className={inputCls}>
                      <option value="">Select vendor…</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}
                    </select>
                  </div>
                  {!editVendorId && (
                    <div>
                      <p className="text-[9px] text-gray-500 mb-0.5">Or enter vendor name</p>
                      <input value={editVendorName} onChange={e => setEditVendorName(e.target.value)} placeholder="Vendor name" className={inputCls} />
                    </div>
                  )}

                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left px-1 py-0.5 font-semibold text-gray-500">Item</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Qty</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Price</th>
                        <th className="text-right px-1 py-0.5 font-semibold text-gray-500">Total</th>
                        <th className="w-5" />
                      </tr>
                    </thead>
                    <tbody>
                      {editLines.map((l, idx) => (
                        <tr key={l.id ?? `new-${idx}`} className="border-b border-gray-100">
                          <td className="px-1 py-0.5 text-gray-800">{l.itemName}</td>
                          <td className="px-1 py-0.5">
                            <input type="number" min="0" step="any" value={l.qty} onChange={e => updateEditLine(idx, 'qty', e.target.value)}
                              className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-1 py-0.5">
                            <input type="number" min="0" step="any" value={l.price} onChange={e => updateEditLine(idx, 'price', e.target.value)}
                              className="w-full text-right bg-gray-50 border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-blue-400" />
                          </td>
                          <td className="px-1 py-0.5 text-right text-gray-700">
                            {((parseFloat(l.qty) || 0) * (parseFloat(l.price) || 0)).toFixed(0)}
                          </td>
                          <td className="px-0.5 py-0.5 text-center">
                            <button onClick={() => removeEditLine(idx)} title="Remove item"
                              className="text-red-500 hover:text-red-700 font-bold leading-none">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-200 bg-gray-50">
                        <td colSpan={3} className="px-1 py-0.5 text-right font-bold text-gray-600">Total</td>
                        <td className="px-1 py-0.5 text-right font-bold text-gray-900">{editTotal.toFixed(0)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>

                  <div className="relative">
                    <input value={editQuery} onChange={e => setEditQuery(e.target.value)}
                      placeholder="+ Search item to add…" className={inputCls} />
                    {editResults.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-32 overflow-y-auto">
                        {editResults.map(item => (
                          <button key={item.id} onClick={() => addEditLine(item)}
                            className="w-full text-left px-2 py-1 text-[10px] text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
                            {item.name}
                            <span className="text-gray-400 ml-1.5">{item.group}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] text-gray-500 mb-0.5">Notes</p>
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className={inputCls} />
                  </div>

                  {editError && <p className="text-[10px] text-red-500 font-medium">{editError}</p>}
                  <div className="flex gap-1">
                    <button onClick={saveEdit} disabled={editSaving}
                      className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                      {editSaving ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditMode(false)} disabled={editSaving}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                  </div>
                </div>
              )}

              {!editMode && receiveOpen && (
                <div className="p-2 bg-green-50 border-b border-green-100 space-y-2">
                  <p className="text-[10px] font-bold text-green-800">Receive Items</p>
                  <div>
                    <p className="text-[9px] text-gray-500 mb-0.5">Date received</p>
                    <input type="date" value={receiveDate} onChange={e => setReceiveDate(e.target.value)} className={inputCls} />
                  </div>
                  {detail.lines.map(l => {
                    const remaining = parseFloat(l.qty_ordered) - parseFloat(l.qty_received)
                    if (remaining <= 0.001) return null
                    return (
                      <div key={l.id} className="bg-white border border-green-100 rounded p-1.5">
                        <p className="text-[10px] text-gray-800 font-medium mb-1">{l.item_name} <span className="text-gray-400 font-normal">({remaining} left)</span></p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[9px] text-gray-400 mb-0.5">Qty received</p>
                            <input type="number" min="0" max={remaining} step="any" value={receiveQtys[l.id] ?? ''}
                              onChange={e => setReceiveQtys(q => ({ ...q, [l.id]: e.target.value }))} className={inputCls} />
                          </div>
                          <div>
                            <p className="text-[9px] text-gray-400 mb-0.5">Unit price</p>
                            <input type="number" min="0" step="any" value={receivePrices[l.id] ?? ''}
                              onChange={e => setReceivePrices(q => ({ ...q, [l.id]: e.target.value }))} className={inputCls} />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {receiveError && <p className="text-[10px] text-red-500 font-medium">{receiveError}</p>}
                  <div className="flex gap-1">
                    <button onClick={submitReceive} disabled={busy}
                      className="flex-1 bg-green-600 text-white text-[10px] font-bold rounded py-1 disabled:opacity-40">
                      {busy ? 'Saving…' : 'Confirm Receipt'}
                    </button>
                    <button onClick={() => setReceiveOpen(false)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
                  </div>
                </div>
              )}

              {!editMode && (
                <>
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr>
                        <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">item</th>
                        <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">ord</th>
                        <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">recv</th>
                        <th className="text-right px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines.map((l, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-1.5 py-0.5 text-gray-900">
                            {l.item_id ? (
                              <Link href={`/stock/${l.item_id}`} className="text-blue-600 hover:underline">
                                {l.item_name}
                              </Link>
                            ) : l.item_name}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-gray-700">{fmt(l.qty_ordered)}</td>
                          <td className={`px-1.5 py-0.5 text-right font-semibold ${parseFloat(l.qty_received) >= parseFloat(l.qty_ordered) ? 'text-green-600' : parseFloat(l.qty_received) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                            {fmt(l.qty_received)}
                          </td>
                          <td className="px-1.5 py-0.5 text-right text-gray-700">{fmt(l.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {detail.receipts.length > 0 && (
                    <div className="border-t border-gray-200">
                      <p className="text-[9px] font-bold text-gray-500 px-1.5 py-1 bg-gray-50">Receiving History</p>
                      {detail.receipts.map(r => (
                        <div key={r.id} className="px-1.5 py-1 border-b border-gray-100 text-[9px]">
                          <p className="text-gray-700">
                            <span className="font-semibold text-gray-900">{fmtShort(r.received_date)}</span>
                            {r.received_by && <span className="text-gray-400"> · {r.received_by}</span>}
                            {r.bill_number && <span className="text-gray-400"> · {r.bill_number}</span>}
                          </p>
                          <p className="text-gray-400">
                            {r.lines.map(l => `${l.item_name} (${fmt(l.quantity)})`).join(', ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
