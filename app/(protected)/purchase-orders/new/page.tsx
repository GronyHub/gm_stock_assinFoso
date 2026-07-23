'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type Item = { id: number; name: string; group: string; soh: number }
type Vendor = { id: number; display_name: string }
type Line = { item: Item; qty: number; price: number }

export default function NewPurchaseOrderPage({ onSuccess }: { onSuccess?: () => void } = {}) {
  usePresenceReporter('entering a purchase order')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [expectedDate, setExpectedDate] = useState('')
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorId, setVendorId] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const debounce = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    fetch('/api/vendors').then(r => r.json()).then(setVendors)
  }, [])

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    clearTimeout(debounce.current ?? undefined)
    debounce.current = setTimeout(async () => {
      const r = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`)
      setResults(await r.json())
    }, 250)
  }, [query])

  function addItem(item: Item) { setLines(p => [...p, { item, qty: 1, price: 0 }]); setQuery(''); setResults([]) }
  function removeLine(i: number) { setLines(p => p.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, f: 'qty' | 'price', v: number) { setLines(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l)) }
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lines.length) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderDate, expectedDate: expectedDate || null, vendorId: vendorId ? Number(vendorId) : null,
          vendorName: vendorName || null, notes: notes || null,
          lines: lines.map(l => ({ itemId: l.item.id, itemName: l.item.name, qty: l.qty, price: l.price })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setSaving(false)
      if (res.ok) {
        setDone(true)
        setTimeout(() => onSuccess ? onSuccess() : router.push('/item'), 1200)
      } else {
        setError(d.error || 'Could not save purchase order. Please try again.')
      }
    } catch {
      setSaving(false)
      setError('Network error — could not reach the server. Please try again.')
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-5xl mb-4">✓</p>
      <p className="text-gray-900 font-semibold text-lg">Purchase order saved!</p>
    </div>
  )

  return (
    <div className="py-4 max-w-lg space-y-4">
      <h1 className="text-xl font-bold">New Purchase Order</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Order Date</label>
          <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Expected Delivery Date (optional)</label>
          <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Vendor</label>
          <select value={vendorId} onChange={e => setVendorId(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Select vendor…</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.display_name}</option>)}
          </select>
        </div>

        {!vendorId && (
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Or enter vendor name</label>
            <input value={vendorName} onChange={e => setVendorName(e.target.value)} placeholder="Vendor name"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        )}

        <div className="relative">
          <label className="text-sm text-gray-600 block mb-1.5">Add Item</label>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search item…"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          {results.length > 0 && (
            <ul className="absolute z-20 w-full bg-white border border-gray-300 rounded-xl mt-1 max-h-56 overflow-y-auto shadow-xl">
              {results.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => addItem(item)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-100 transition">
                    <span className="text-gray-900 text-base">{item.name}</span>
                    <span className="text-gray-400 ml-2 text-sm">{item.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {lines.map((l, i) => (
          <div key={i} className="bg-white border border-gray-300 rounded-xl p-4">
            <div className="flex justify-between mb-3">
              <span className="text-gray-900 font-medium">{l.item.name}</span>
              <button type="button" onClick={() => removeLine(i)}
                className="text-gray-400 hover:text-red-400 text-sm px-2 py-1">Remove</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['qty', 'price'] as const).map(f => (
                <div key={f}>
                  <label className="text-xs text-gray-400 block mb-1">{f === 'price' ? 'Unit Price' : 'Qty'}</label>
                  <input type="number" min="0" step="any" value={l[f]}
                    onChange={e => updateLine(i, f, Number(e.target.value))}
                    inputMode="decimal"
                    className="w-full bg-gray-100 rounded-lg px-3 py-2.5 text-base text-gray-900 outline-none" />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-400 block mb-1">Total</label>
                <p className="text-base text-gray-900 font-medium py-2.5">₵ {(l.qty * l.price).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}

        {lines.length > 0 && <div className="text-right text-gray-900 font-bold text-xl py-1">Total: ₵ {total.toFixed(2)}</div>}

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything the vendor or a future receiver should know"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
        <button type="submit" disabled={!lines.length || saving}
          className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-base transition">
          {saving ? 'Saving…' : 'Save Purchase Order'}
        </button>
      </form>
    </div>
  )
}
