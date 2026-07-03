'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number }
type CartLine = { item: Item; qty: number; price: number }

export default function NewReceiptPage({ onSuccess }: { onSuccess?: () => void } = {}) {
  usePresenceReporter('entering a sale')
  const [date, setDate] = useState('')
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [customer, setCustomer] = useState('')
  const [cashCounted, setCashCounted] = useState('')
  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [cart, setCart] = useState<CartLine[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  useEffect(() => { setDate(new Date().toISOString().slice(0, 10)) }, [])

  useEffect(() => {
    fetch('/api/items/all')
      .then(r => r.json())
      .then(d => { setAllItems(Array.isArray(d) ? d : []); setLoadingItems(false) })
      .catch(() => setLoadingItems(false))
  }, [])

  // Groups derived from items
  const groups = ['All', ...Array.from(new Set(allItems.map(i => i.group ?? 'Other'))).sort()]

  // Items shown in catalogue panel
  const catalogueItems = (() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return allItems.filter(i => i.name.toLowerCase().includes(q) || (i.group ?? '').toLowerCase().includes(q))
    }
    if (activeGroup && activeGroup !== 'All') {
      return allItems.filter(i => (i.group ?? 'Other') === activeGroup)
    }
    return allItems
  })()

  function addToCart(item: Item) {
    setCart(prev => {
      const idx = prev.findIndex(l => l.item.id === item.id)
      if (idx >= 0) return prev.map((l, i) => i === idx ? { ...l, qty: l.qty + 1 } : l)
      return [...prev, { item, qty: 1, price: Number(item.selling_price) }]
    })
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) { removeFromCart(idx); return }
    setCart(prev => prev.map((l, i) => i === idx ? { ...l, qty } : l))
  }

  function updatePrice(idx: number, price: number) {
    setCart(prev => prev.map((l, i) => i === idx ? { ...l, price } : l))
  }

  function removeFromCart(idx: number) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const total = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const change = cashCounted ? Number(cashCounted) - total : null

  async function handleSubmit() {
    if (!cart.length) return
    setSaving(true)
    setError('')
    try {
      const customerName = saleType === 'GMC' ? 'Grony Multimedia as Customer' : (customer.trim() || null)
      const res = await fetch('/api/sales/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          customerName,
          cashCounted: cashCounted ? Number(cashCounted) : null,
          lines: cart.map(l => ({
            itemId: l.item.id,
            itemName: l.item.name,
            qty: l.qty,
            price: l.price,
            total: l.qty * l.price,
          })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setSaving(false)
      if (res.ok) {
        setDone(d.receiptNumber)
        setTimeout(() => onSuccess ? onSuccess() : router.push('/sales'), 1500)
      } else {
        setError(d.error || 'Could not save receipt. Please try again.')
      }
    } catch (e) {
      setSaving(false)
      setError('Network error — could not reach the server. Please try again.')
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-green-600 font-bold text-lg">✓ Saved</p>
      <p className="text-gray-500 text-sm mt-1">{done}</p>
    </div>
  )

  return (
    // Full-height two-column split
    <div className="flex gap-0 -mx-4 -mt-4 h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* ── LEFT: Item Catalogue ────────────────────────────── */}
      <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white min-h-0">
        {/* Search */}
        <div className="px-2 py-1.5 border-b border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Item Catalogue</p>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveGroup(null) }}
placeholder={loadingItems ? 'Loading…' : `Search ${allItems.length} items…`}
            disabled={loadingItems}
            className="w-full text-[11px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Group chips */}
        <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-gray-100 overflow-x-auto">
          {groups.map(g => (
            <button key={g} type="button"
              onClick={() => { setActiveGroup(g === activeGroup ? null : g); setSearch('') }}
              className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition
                ${activeGroup === g ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {g}
            </button>
          ))}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingItems ? (
            <p className="text-[10px] text-gray-400 text-center py-6">Loading…</p>
          ) : catalogueItems.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-6">No items found</p>
          ) : (
            catalogueItems.map(item => {
              const inCart = cart.find(l => l.item.id === item.id)
              return (
                <div key={item.id} className="flex items-center px-2 py-1.5 border-b border-gray-50 gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-gray-900 leading-tight" style={{ wordBreak: 'break-word' }}>{item.name}</p>
                    <p className="text-[9px] leading-tight">
                      <span className="text-blue-600 font-bold">₵{Number(item.selling_price).toFixed(2)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-green-600 font-bold">CP ₵{Number(item.cost_price).toFixed(2)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-red-500 font-bold">{Number(item.soh)} pcs</span>
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => addToCart(item)}
                    className={`shrink-0 w-6 h-6 rounded-full text-white text-sm font-bold flex items-center justify-center transition
                      ${inCart ? 'bg-green-600' : 'bg-blue-500 hover:bg-blue-600'}`}>
                    {inCart ? `${inCart.qty}` : '+'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: Receipt ─────────────────────────────────── */}
      <div className="w-1/2 flex flex-col bg-gray-50 min-h-0">

        {/* Receipt header */}
        <div className="px-2 py-1.5 bg-white border-b border-gray-200 space-y-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase">New Sales Receipt</p>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <p className="text-[9px] text-gray-400">Date</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full text-[10px] text-gray-900 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none" />
            </div>
            <div>
              <p className="text-[9px] text-gray-400">Sale Type</p>
              <div className="flex gap-1">
                <button type="button" onClick={() => setSaleType('WIC')}
                  className={`flex-1 text-[10px] font-bold py-0.5 rounded transition
                    ${saleType === 'WIC' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  WIC
                </button>
                <button type="button" onClick={() => setSaleType('GMC')}
                  className={`flex-1 text-[10px] font-bold py-0.5 rounded transition
                    ${saleType === 'GMC' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  GMC
                </button>
              </div>
            </div>
          </div>
          {saleType === 'WIC' ? (
            <div>
              <p className="text-[9px] text-gray-400">Customer (optional — leave blank for a walk-in)</p>
              <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Walk-in Customer"
                className="w-full text-[10px] text-gray-900 bg-gray-50 border border-gray-200 rounded px-1 py-0.5 outline-none placeholder-gray-300" />
            </div>
          ) : (
            <p className="text-[9px] text-purple-600 font-semibold">Internal use — recorded as &quot;Grony Multimedia as Customer&quot;</p>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cart.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-8">Tap + to add items</p>
          ) : (
            <>
              {/* Cart header */}
              <div className="grid grid-cols-[1fr_28px_38px_38px_14px] gap-0.5 px-2 py-1 bg-gray-100 border-b border-gray-200 sticky top-0">
                <span className="text-[8px] text-gray-500 font-semibold uppercase">Item</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Qty</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Price</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Total</span>
                <span />
              </div>
              {cart.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_28px_38px_38px_14px] gap-0.5 items-center px-2 py-1 border-b border-gray-100">
                  <p className="text-[9px] font-semibold text-gray-900 leading-tight truncate">{l.item.name}</p>
                  <input type="number" min="1" step="any" inputMode="decimal"
                    value={l.qty}
                    onChange={e => updateQty(idx, Number(e.target.value))}
                    className="w-full text-center text-[9px] text-gray-900 bg-white border border-gray-200 rounded px-0.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                  <input type="number" min="0" step="0.01" inputMode="decimal"
                    value={l.price}
                    onChange={e => updatePrice(idx, Number(e.target.value))}
                    className="w-full text-center text-[9px] text-gray-900 bg-white border border-gray-200 rounded px-0.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                  <p className="text-[9px] font-bold text-gray-900 text-center">₵{(l.qty * l.price).toFixed(0)}</p>
                  <button type="button" onClick={() => removeFromCart(idx)}
                    className="text-gray-300 hover:text-red-400 text-xs font-bold text-center leading-none transition">×</button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer: total + cash + save */}
        <div className="border-t border-gray-200 bg-white px-2 py-1.5 space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-gray-900">
            <span>{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            <span>₵{total.toFixed(2)}</span>
          </div>
          <input type="number" step="0.01" inputMode="decimal" value={cashCounted}
            onChange={e => setCashCounted(e.target.value)} placeholder="Cash counted (₵)"
            className="w-full text-[10px] text-gray-900 bg-gray-50 border border-gray-200 rounded px-2 py-0.5 outline-none placeholder-gray-300" />
          {change !== null && (
            <p className={`text-[10px] font-bold text-right ${change >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              Change: ₵{change.toFixed(2)}
            </p>
          )}
          {error && (
            <p className="text-[10px] text-red-500 font-medium text-center">{error}</p>
          )}
          <button type="button" onClick={handleSubmit} disabled={!cart.length || saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold text-[11px] rounded-lg py-1.5 transition">
            {saving ? 'Saving…' : `Save ${saleType} Receipt — ₵${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
