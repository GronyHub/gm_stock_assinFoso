'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type Item = { id: number; name: string; group: string | null; soh: number; selling_price: string | number; cost_price: string | number; product_type: string | null }
type Tap = { id: number; item_id: number; item_name: string; price: number | string; staff_name: string; tapped_at: string; undone: boolean; receipt_id?: number; quantity: number; soh?: number | null }

export default function LiveSalePage(props: any = {}) {
  usePresenceReporter('live-tapping a sale')

  const { initialShowLog = false } = props

  const [allItems, setAllItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  const [search, setSearch] = useState('')
  const [saleType, setSaleType] = useState<'WIC' | 'GMC'>('WIC')
  const [error, setError] = useState('')
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [qty, setQty] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [showLog, setShowLog] = useState(initialShowLog)

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
      .then(d => { setTaps(Array.isArray(d) ? d : []) })
      .catch(() => {})
  }, [])

  // Filter items by search
  const catalogueItems = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase()
      return allItems.filter(i => i.name.toLowerCase().includes(q))
    }
    return allItems
  }, [allItems, search])

  // Count sales today by item
  const today = new Date().toISOString().slice(0, 10)
  const salesCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const tap of taps) {
      if (!tap.undone && tap.tapped_at.startsWith(today)) {
        counts.set(tap.item_id, (counts.get(tap.item_id) ?? 0) + tap.quantity)
      }
    }
    return counts
  }, [taps, today])

  async function recordTap() {
    if (!selectedItem || !qty) return
    setSaving(true)
    setError('')

    const qtyNum = Number(qty)
    const priceNum = price ? Number(price) : Number(selectedItem.selling_price)

    if (qtyNum <= 0) {
      setError('Quantity must be greater than 0')
      setSaving(false)
      return
    }

    if (priceNum <= 0) {
      setError('Price must be greater than 0')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: selectedItem.id,
          quantity: qtyNum,
          customPrice: price ? priceNum : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not record tap')
        setSaving(false)
        return
      }
      setTaps(prev => [data.tap, ...prev])
      setSelectedItem(null)
      setQty('')
      setPrice('')
    } catch (e) {
      setError('Network error')
    } finally {
      setSaving(false)
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

  // Log view
  if (showLog) {
    const today = new Date().toISOString().slice(0, 10)
    const todayTaps = taps.filter(t => t.tapped_at.startsWith(today))
    const total = todayTaps.reduce((s, t) => s + (t.undone ? 0 : Number(t.price) * t.quantity), 0)

    return (
      <div className="h-full flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-bold text-gray-900">Live Sale Log — {today}</h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {todayTaps.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sales recorded</p>
          ) : (
            <div className="divide-y divide-gray-200">
              {todayTaps.map(tap => (
                <div
                  key={tap.id}
                  className={`px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition ${
                    tap.undone ? 'opacity-50 bg-gray-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${tap.undone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {tap.item_name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {tap.staff_name} · {new Date(tap.tapped_at).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="shrink-0 text-right ml-4">
                    <p className="text-sm font-semibold text-gray-900">₵{(Number(tap.price) * tap.quantity).toFixed(2)}</p>
                    <p className="text-xs text-gray-500">{tap.quantity} × ₵{Number(tap.price).toFixed(2)}</p>
                  </div>
                  {!tap.undone && (
                    <button
                      onClick={() => undoTap(tap.id)}
                      className="shrink-0 ml-4 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 rounded transition"
                    >
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex justify-between items-center text-sm font-semibold">
            <span className="text-gray-600">Total ({todayTaps.length} taps)</span>
            <span className="text-lg text-gray-900">₵{total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">Live Sale — {today}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSaleType('WIC')}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition ${
                saleType === 'WIC'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              WIC
            </button>
            <button
              type="button"
              onClick={() => setSaleType('GMC')}
              className={`px-4 py-1.5 text-sm font-semibold rounded transition ${
                saleType === 'GMC'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              GMC
            </button>
          </div>
        </div>
        {saleType === 'GMC' && (
          <p className="text-xs text-purple-600 font-semibold">Recorded as "Grony Multimedia as Customer"</p>
        )}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={loadingItems ? 'Loading…' : 'Search items…'}
          disabled={loadingItems}
          className="w-full text-sm text-gray-900 placeholder-gray-400 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
        />
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {loadingItems ? (
          <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
        ) : catalogueItems.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No items found</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {catalogueItems.map(item => {
              const count = salesCounts.get(item.id) ?? 0
              return (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                      {count > 0 && (
                        <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-bold">
                          {count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 leading-tight">
                      <span className="text-blue-600 font-semibold">₵{Number(item.selling_price).toFixed(2)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-green-600 font-semibold">CP ₵{Number(item.cost_price).toFixed(2)}</span>
                      <span className="text-gray-400"> · </span>
                      <span className="text-red-600 font-semibold">{Number(item.soh)} pcs</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(item)
                      setPrice('')
                      setQty('')
                      setError('')
                    }}
                    className="shrink-0 ml-4 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-2xl shadow-xl">
            <div className="px-4 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">{selectedItem.name}</h3>
              <p className="text-xs text-gray-500 mt-1">
                <span>Selling: ₵{Number(selectedItem.selling_price).toFixed(2)}</span>
                <span className="text-gray-400"> · </span>
                <span>Cost: ₵{Number(selectedItem.cost_price).toFixed(2)}</span>
                <span className="text-gray-400"> · </span>
                <span>Stock: {Number(selectedItem.soh)} pcs</span>
              </p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="1"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="Enter quantity"
                  className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                  disabled={saving}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Price (optional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₵</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder={Number(selectedItem.selling_price).toFixed(2)}
                    className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    disabled={saving}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Defaults to ₵{Number(selectedItem.selling_price).toFixed(2)}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(null)
                    setQty('')
                    setPrice('')
                    setError('')
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={recordTap}
                  disabled={!qty || saving}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Tap'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
