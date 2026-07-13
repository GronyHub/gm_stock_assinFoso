'use client'
import { useState, useEffect, useMemo } from 'react'

type Line = {
  id: number
  item: string
  qty: number
  price: string
  total: string
  unit: string | null
  dimensions: string | null
}

type Receipt = {
  id: number
  invoice_number: string
  invoice_date: string
  due_date: string | null
  status: string | null
  document_type: string | null
  customer_name: string
  customer_display: string | null
  customer_phone: string | null
  customer_organisation: string | null
  customer_town_district: string | null
  customer_region: string | null
  currency_code: string
  subtotal: string
  total: string
  balance: string
  adjustment: string | null
  notes: string | null
  lines: Line[]
}

function c(v: string | null | undefined) {
  const n = parseFloat(v ?? '0')
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

type DraftLine = { item: string; qty: string; price: string; unit: string; dimensions: string }
const emptyLine = (): DraftLine => ({ item: '', qty: '1', price: '', unit: '', dimensions: '' })

function NewReceiptForm({ onCreated, onCancel }: { onCreated: (r: Receipt) => void; onCancel: () => void }) {
  const [documentType, setDocumentType] = useState<'Receipt' | 'Invoice'>('Receipt')
  const [invoiceNumber, setInvoiceNumber] = useState(() => `RCT-${Date.now().toString().slice(-8)}`)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerOrganisation, setCustomerOrganisation] = useState('')
  const [customerTownDistrict, setCustomerTownDistrict] = useState('')
  const [customerRegion, setCustomerRegion] = useState('')

  function setDocType(t: 'Receipt' | 'Invoice') {
    setDocumentType(t)
    // Swap the auto-generated prefix so the number still makes sense; leave
    // a manually-edited number alone.
    setInvoiceNumber(prev => {
      const m = prev.match(/^(RCT|INV)-(.+)$/)
      if (!m) return prev
      return `${t === 'Invoice' ? 'INV' : 'RCT'}-${m[2]}`
    })
  }

  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0)

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l))
  }
  function addLine() { setLines(prev => [...prev, emptyLine()]) }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)) }

  async function submit() {
    setError(null)
    if (!invoiceNumber.trim() || !customerName.trim()) {
      setError('Receipt number and customer name are required.')
      return
    }
    const validLines = lines.filter(l => l.item.trim() && Number(l.qty) > 0)
    if (validLines.length === 0) {
      setError('Add at least one item.')
      return
    }

    setSaving(true)
    const res = await fetch('/api/receipts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: documentType,
        invoice_number: invoiceNumber.trim(),
        invoice_date: date,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_organisation: customerOrganisation.trim() || null,
        customer_town_district: customerTownDistrict.trim() || null,
        customer_region: customerRegion.trim() || null,
        notes: notes.trim() || null,
        lines: validLines.map(l => ({
          item: l.item.trim(),
          qty: Number(l.qty),
          price: Number(l.price) || 0,
          unit: l.unit.trim() || null,
          dimensions: l.dimensions.trim() || null,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      onCreated(await res.json())
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Could not save receipt.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">New {documentType}</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
      </div>

      <div>
        <label className={labelCls}>Document Type</label>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => setDocType('Receipt')}
            className={`flex-1 text-sm font-semibold rounded-lg py-2 transition
              ${documentType === 'Receipt' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Receipt
          </button>
          <button type="button" onClick={() => setDocType('Invoice')}
            className={`flex-1 text-sm font-semibold rounded-lg py-2 transition
              ${documentType === 'Invoice' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            Invoice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>{documentType} Number</label>
          <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Customer Name</label>
        <input value={customerName} onChange={e => setCustomerName(e.target.value)}
          placeholder="Who is this receipt for?" className={inputCls} />
      </div>

      <div>
        <button type="button" onClick={() => setShowMoreDetails(v => !v)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700">
          {showMoreDetails ? '− Hide' : '+ Add'} more customer details (optional)
        </button>
        {showMoreDetails && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Phone Contact</label>
              <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                placeholder="e.g. 024 000 0000" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Organisation</label>
              <input value={customerOrganisation} onChange={e => setCustomerOrganisation(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Town / District</label>
              <input value={customerTownDistrict} onChange={e => setCustomerTownDistrict(e.target.value)}
                className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Region</label>
              <input value={customerRegion} onChange={e => setCustomerRegion(e.target.value)}
                className={inputCls} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Items</label>
        {lines.map((l, i) => (
          <div key={i} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
            <div className="flex gap-1.5">
              <input value={l.item} onChange={e => updateLine(i, { item: e.target.value })}
                placeholder="Item / service" className={inputCls + ' flex-1'} />
              {lines.length > 1 && (
                <button onClick={() => removeLine(i)}
                  className="shrink-0 px-2 text-red-500 hover:text-red-700 font-bold text-lg leading-none">×</button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <input type="number" min="0" step="any" value={l.qty} onChange={e => updateLine(i, { qty: e.target.value })}
                placeholder="Qty" className={inputCls} />
              <input type="number" min="0" step="any" value={l.price} onChange={e => updateLine(i, { price: e.target.value })}
                placeholder="Price" className={inputCls} />
              <input value={l.unit} onChange={e => updateLine(i, { unit: e.target.value })}
                placeholder="Unit" className={inputCls} />
              <input value={l.dimensions} onChange={e => updateLine(i, { dimensions: e.target.value })}
                placeholder="Dimensions" className={inputCls} />
            </div>
          </div>
        ))}
        <button onClick={addLine} className="text-xs font-semibold text-blue-600 hover:text-blue-700">+ Add item</button>
      </div>

      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
        <p className="text-sm text-gray-500">Total: <span className="font-bold text-gray-900">{c(String(total))}</span></p>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : 'Save Receipt'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
      </div>
    </div>
  )
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState<Receipt | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetch('/api/receipts')
      .then(r => r.json())
      .then(d => { setReceipts(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return receipts
    const q = search.toLowerCase()
    return receipts.filter(x =>
      x.invoice_number.toLowerCase().includes(q) ||
      x.customer_name.toLowerCase().includes(q) ||
      (x.customer_display ?? '').toLowerCase().includes(q)
    )
  }, [receipts, search])

  const totals = useMemo(() => ({
    count: receipts.length,
    total: receipts.reduce((s, x) => s + parseFloat(x.total), 0),
  }), [receipts])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Receipts</h1>
        <button onClick={() => setShowForm(f => !f)}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition
            ${showForm ? 'bg-blue-700 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
          {showForm ? '×' : '+ New Receipt'}
        </button>
      </div>

      {showForm && (
        <NewReceiptForm
          onCancel={() => setShowForm(false)}
          onCreated={r => { setReceipts(prev => [r, ...prev]); setShowForm(false) }}
        />
      )}

      {/* Summary cards -- every receipt here is fully paid once issued, so there's
          no Closed/Draft/Overdue distinction to track. */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Total Value</p>
          <p className="text-base font-bold text-gray-900">{c(String(totals.total))}</p>
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400 font-medium">Total Receipts</p>
          <p className="text-base font-bold text-blue-700">{String(totals.count)}</p>
        </div>
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by receipt number or customer…"
        className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Selected receipt detail */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 rounded px-1.5 py-0.5 mb-1">
                {selected.document_type ?? 'Receipt'}
              </span>
              <p className="font-bold text-gray-900">{selected.invoice_number}</p>
              <p className="text-sm text-gray-600">{selected.customer_display ?? selected.customer_name}</p>
              <p className="text-[10px] text-gray-400 mt-1">{fmtDate(selected.invoice_date)}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
          </div>

          {(selected.customer_phone || selected.customer_organisation || selected.customer_town_district || selected.customer_region) && (
            <div className="border-t border-gray-100 pt-2 text-xs text-gray-500 space-y-0.5">
              {selected.customer_organisation && <p>{selected.customer_organisation}</p>}
              {selected.customer_phone && <p>☎ {selected.customer_phone}</p>}
              {(selected.customer_town_district || selected.customer_region) && (
                <p>{[selected.customer_town_district, selected.customer_region].filter(Boolean).join(', ')}</p>
              )}
            </div>
          )}

          <a href={`/receipts/${selected.id}/print`} target="_blank" rel="noopener noreferrer"
            className="block text-center bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl py-2.5 transition">
            🖨️ Print / Save as PDF
          </a>

          <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400">Subtotal</p>
              <p className="text-sm font-bold text-gray-900">{c(selected.subtotal)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-gray-400">Total</p>
              <p className="text-sm font-bold text-gray-900">{c(selected.total)}</p>
            </div>
          </div>

          {/* Line items */}
          {selected.lines.length > 0 && (
            <div className="border-t border-gray-100 pt-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Items</p>
              {selected.lines.map(l => (
                <div key={l.id} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{l.item}</p>
                    <p className="text-gray-400">
                      {l.qty} {l.unit ?? 'unit'}{Number(l.qty) !== 1 ? 's' : ''}
                      {l.dimensions ? ` · ${l.dimensions}` : ''}
                      {' @ '}{c(l.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold text-gray-900">{c(l.total)}</p>
                </div>
              ))}
            </div>
          )}

          {selected.notes && selected.notes !== 'Thanks for your business.' && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-xs text-gray-400">Notes</p>
              <p className="text-xs text-gray-700 mt-0.5">{selected.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Receipt list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-gray-400 text-sm">No receipts found.</p>
        )}
        {filtered.map(r => (
          <button key={r.id} onClick={() => setSelected(r === selected ? null : r)}
            className={`w-full text-left rounded-xl border p-3 transition
              ${selected?.id === r.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  {r.invoice_number}
                  {r.document_type === 'Invoice' && (
                    <span className="ml-1.5 align-middle text-[9px] font-bold uppercase tracking-wide text-blue-700 bg-blue-50 rounded px-1 py-0.5">Invoice</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">{r.customer_display ?? r.customer_name}</p>
              </div>
              <p className="shrink-0 text-sm font-bold text-gray-900">{c(r.total)}</p>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">{fmtDate(r.invoice_date)} · {r.lines.length} item{r.lines.length !== 1 ? 's' : ''}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
