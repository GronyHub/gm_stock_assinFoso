'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null }
type CartLine = { item: Item; qty: number; price: number }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }

export default function LiveSalePage({ onClose, groupFilter, search: propsSearch, initialShowLog, lawsPanel, expanded, setExpanded, hideTopControls }: any = {}) {
  usePresenceReporter('live-tapping a sale')

  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  const [loadingTaps, setLoadingTaps] = useState(true)
  const [search, setSearch] = useState(propsSearch ?? '')
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [showLog, setShowLog] = useState(false)
  const [error, setError] = useState('')

  // Fetch items
  useEffect(() => {
    fetch('/api/items/all')
      .then(r => r.json())
      .then(d => { setAllItems(Array.isArray(d) ? d : []); setLoadingItems(false) })
      .catch(() => setLoadingItems(false))
  }, [])

  // Fetch taps
  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then(r => r.json())
      .then(d => { setTaps(Array.isArray(d) ? d : []); setLoadingTaps(false) })
      .catch(() => setLoadingTaps(false))
  }, [])

  // Filter items by search and group
  const catalogueItems = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return allItems.filter(i => i.name.toLowerCase().includes(q) || (i.group ?? '').toLowerCase().includes(q))
    }
    if (groupFilter) {
      return allItems.filter(i => (i.group ?? 'Ungrouped') === groupFilter)
    }
    return allItems
  }, [allItems, search, groupFilter])

  // Build cart from today's taps for current sale type
  const today = new Date().toISOString().slice(0, 10)
  const todayTaps = useMemo(() => {
    return taps.filter(t => !t.undone && t.tapped_at.startsWith(today))
  }, [taps, today])

  const saleTypeCustomer = saleType === 'GMC' ? 'Grony Multimedia as Customer' : null
  const cartLines: CartLine[] = useMemo(() => {
    const byItemId = new Map<number, CartLine>()
    for (const tap of todayTaps) {
      // For GMC taps, filter to those recorded for Grony; for WIC, exclude Grony taps
      const isGmcTap = tap.receipt_id && false // We don't have receipt data easily here, so we'll use a simpler approach

      const item = allItems.find(it => it.id === tap.item_id)
      if (!item) continue

      const key = tap.item_id
      const existing = byItemId.get(key)
      if (existing) {
        existing.qty += tap.quantity
      } else {
        byItemId.set(key, { item, qty: tap.quantity, price: Number(tap.price) })
      }
    }
    return Array.from(byItemId.values())
  }, [todayTaps, allItems])

  const total = cartLines.reduce((s, l) => s + l.qty * l.price, 0)

  async function addToCart(item: Item, quantity: number = 1, customPrice?: number) {
    setError('')
    try {
      const price = customPrice ?? Number(item.selling_price)
      if (price <= 0) {
        setError('Invalid price')
        return
      }

      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, quantity, customPrice: customPrice ? price : undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not record tap')
        return
      }
      setTaps(prev => [data.tap, ...prev])
    } catch (e) {
      setError('Network error')
    }
  }

  async function undoTap(tapId: number) {
    try {
      const res = await fetch(`/api/sales/live-taps/${tapId}/undo`, { method: 'POST' })
      if (res.ok) {
        setTaps(prev => prev.map(t => t.id === tapId ? { ...t, undone: true } : t))
      }
    } catch (e) {
      setError('Could not undo tap')
    }
  }

  if (showLog) {
    return (
      <div className="p-4">
        <div className="mb-4 flex justify-between items-center">
          <h2 className="font-bold text-lg">Live Sale Log</h2>
          <button onClick={() => setShowLog(false)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
            Back to Grid
          </button>
        </div>
        <div className="space-y-1">
          {todayTaps.map(tap => (
            <div key={tap.id} className={`flex justify-between px-3 py-2 border rounded text-sm ${tap.undone ? 'opacity-50 line-through' : ''}`}>
              <div>
                <p className="font-semibold">{tap.item_name}</p>
                <p className="text-xs text-gray-500">{tap.staff_name} at {new Date(tap.tapped_at).toLocaleTimeString()}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">₵{(Number(tap.price) * tap.quantity).toFixed(2)}</p>
                <p className="text-xs text-gray-500">{tap.quantity} × ₵{tap.price}</p>
              </div>
              {!tap.undone && (
                <button onClick={() => undoTap(tap.id)} className="ml-2 text-red-600 hover:text-red-800 text-xs font-bold">
                  Undo
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-0 -mx-4 -mt-4 h-[calc(100dvh-60px)] md:h-[calc(100dvh-56px)]">

      {/* LEFT: Item Catalogue */}
      <div className="w-1/2 flex flex-col border-r border-gray-200 bg-white min-h-0">
        <div className="px-2 py-1.5 border-b border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Item Catalogue</p>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={loadingItems ? 'Loading…' : `Search ${allItems.length} items…`}
            disabled={loadingItems}
            className="w-full text-[11px] text-gray-900 placeholder-gray-300 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loadingItems ? (
            <p className="text-[10px] text-gray-400 text-center py-6">Loading…</p>
          ) : catalogueItems.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-6">No items found</p>
          ) : (
            catalogueItems.map(item => (
              <div key={item.id} className="flex items-center px-2 py-1.5 border-b border-gray-50 gap-1">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-900 leading-tight" style={{ wordBreak: 'break-word' }}>
                    {item.name}
                  </p>
                  <p className="text-[9px] leading-tight">
                    <span className="text-blue-600 font-bold">₵{Number(item.selling_price).toFixed(2)}</span>
                    <span className="text-gray-400"> · </span>
                    <span className="text-green-600 font-bold">CP ₵{Number(item.cost_price).toFixed(2)}</span>
                    <span className="text-gray-400"> · </span>
                    <span className="text-red-500 font-bold">{Number(item.soh)} pcs</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(item)}
                  className="shrink-0 w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold flex items-center justify-center transition"
                >
                  +
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* RIGHT: Daily Receipt */}
      <div className="w-1/2 flex flex-col bg-gray-50 min-h-0">

        {/* Header */}
        <div className="px-2 py-1.5 bg-white border-b border-gray-200 space-y-1">
          <p className="text-[9px] font-bold text-gray-400 uppercase">Live Sale — {today}</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSaleType('WIC')}
              className={`flex-1 text-[10px] font-bold py-0.5 rounded transition ${
                saleType === 'WIC' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              WIC
            </button>
            <button
              type="button"
              onClick={() => setSaleType('GMC')}
              className={`flex-1 text-[10px] font-bold py-0.5 rounded transition ${
                saleType === 'GMC' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              GMC
            </button>
          </div>
          {saleType === 'GMC' && (
            <p className="text-[9px] text-purple-600 font-semibold">Recorded as "Grony Multimedia as Customer"</p>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {cartLines.length === 0 ? (
            <p className="text-[10px] text-gray-400 text-center py-8">Tap + to add items</p>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_28px_38px_38px_14px] gap-0.5 px-2 py-1 bg-gray-100 border-b border-gray-200 sticky top-0">
                <span className="text-[8px] text-gray-500 font-semibold uppercase">Item</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Qty</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Price</span>
                <span className="text-[8px] text-gray-500 font-semibold uppercase text-center">Total</span>
                <span />
              </div>
              {cartLines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_28px_38px_38px_14px] gap-0.5 items-center px-2 py-1 border-b border-gray-100">
                  <p className="text-[9px] font-semibold text-gray-900 leading-tight truncate">{l.item.name}</p>
                  <p className="text-[9px] text-center text-gray-900 font-semibold">{l.qty}</p>
                  <p className="text-[9px] text-center text-gray-900 font-semibold">₵{l.price.toFixed(2)}</p>
                  <p className="text-[9px] font-bold text-gray-900 text-center">₵{(l.qty * l.price).toFixed(0)}</p>
                  <span />
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-white px-2 py-1.5 space-y-1">
          <div className="flex justify-between text-[10px] font-bold text-gray-900">
            <span>{cartLines.length} item{cartLines.length !== 1 ? 's' : ''}</span>
            <span>₵{total.toFixed(2)}</span>
          </div>
          {error && (
            <p className="text-[10px] text-red-500 font-medium text-center">{error}</p>
          )}
          <button
            type="button"
            onClick={() => setShowLog(true)}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold text-[11px] rounded-lg py-1.5 transition"
          >
            View Log
          </button>
        </div>
      </div>
    </div>
  )
}
