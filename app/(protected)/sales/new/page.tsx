'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: number; name: string; group: string; soh: number; selling_price: number }
type Line = { item: Item | null; qty: number; price: number; search: string; open: boolean }

const EMPTY_LINE = (): Line => ({ item: null, qty: 1, price: 0, search: '', open: false })

const inputCls = 'w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'

export default function NewReceiptPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [customer, setCustomer] = useState('')
  const [cashCounted, setCashCounted] = useState('')
  const [lines, setLines] = useState<Line[]>([EMPTY_LINE()])
  const [allItems, setAllItems] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/items/all').then(r => r.json()).then(setAllItems)
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLines(prev => prev.map(l => ({ ...l, open: false })))
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function filteredItems(search: string) {
    if (!search) return allItems
    const q = search.toLowerCase()
    return allItems.filter(i => i.name.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
  }

  function setLineField<K extends keyof Line>(idx: number, field: K, val: Line[K]) {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: val } : l))
  }

  function selectItem(idx: number, item: Item) {
    setLines(prev => prev.map((l, i) => i === idx
      ? { ...l, item, search: item.name, price: item.selling_price, qty: 1, open: false }
      : l
    ))
    // Add a new empty line if this was the last one
    setLines(prev => {
      if (idx === prev.length - 1) return [...prev, EMPTY_LINE()]
      return prev
    })
  }

  function removeLine(idx: number) {
    setLines(prev => {
      const next = prev.filter((_, i) => i !== idx)
      return next.length === 0 ? [EMPTY_LINE()] : next
    })
  }

  function addLine() {
    setLines(prev => [...prev, EMPTY_LINE()])
  }

  const filledLines = lines.filter(l => l.item)
  const total = filledLines.reduce((s, l) => s + l.qty * l.price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!filledLines.length) return
    setSaving(true)
    const res = await fetch('/api/sales/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        customer: customer || 'Walk In Customer',
        cashCounted: cashCounted ? Number(cashCounted) : null,
        lines: filledLines.map(l => ({
          itemId: l.item!.id,
          itemName: l.item!.name,
          qty: l.qty,
          price: l.price,
          total: l.qty * l.price,
        })),
      }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      setDone(d.receiptNumber)
      setTimeout(() => router.push('/sales'), 1500)
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-gray-900 font-semibold text-lg mt-4">Receipt {done} saved!</p>
    </div>
  )

  return (
    <div className="py-4 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">New Sales Receipt</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Customer</label>
            <input value={customer} onChange={e => setCustomer(e.target.value)}
              placeholder="Walk In Customer" className={inputCls} />
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Cash Counted (₵)</label>
          <input type="number" step="0.01" value={cashCounted} onChange={e => setCashCounted(e.target.value)}
            placeholder="0.00" inputMode="decimal" className={inputCls} />
        </div>

        {/* Item lines table */}
        <div>
          <label className="text-sm text-gray-600 block mb-2">Items</label>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_90px_80px_28px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              <span>Item Details</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Amount</span>
              <span />
            </div>

            {/* Lines */}
            <div ref={dropdownRef} className="divide-y divide-gray-100">
              {lines.map((line, idx) => {
                const results = filteredItems(line.search)
                return (
                  <div key={idx} className="relative">
                    <div className="grid grid-cols-[1fr_80px_90px_80px_28px] gap-2 px-3 py-2.5 items-center">
                      {/* Item search */}
                      <div className="relative">
                        <input
                          value={line.search}
                          onChange={e => {
                            setLineField(idx, 'search', e.target.value)
                            setLineField(idx, 'open', true)
                            setLineField(idx, 'item', null)
                          }}
                          onFocus={() => setLineField(idx, 'open', true)}
                          placeholder="Type or click to select an item"
                          className="w-full text-sm text-gray-900 placeholder-gray-400 outline-none py-1"
                        />
                        {line.item && (
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            SOH: {line.item.soh} pcs
                          </p>
                        )}
                      </div>

                      {/* Rate */}
                      <input
                        type="number" min="0" step="0.01"
                        value={line.price}
                        onChange={e => setLineField(idx, 'price', Number(e.target.value))}
                        inputMode="decimal"
                        className="w-full text-right text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
                      />

                      {/* Qty */}
                      <input
                        type="number" min="0.01" step="any"
                        value={line.qty}
                        onChange={e => setLineField(idx, 'qty', Number(e.target.value))}
                        inputMode="decimal"
                        className="w-full text-right text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
                      />

                      {/* Amount */}
                      <p className="text-right text-sm font-medium text-gray-900">
                        {line.item ? (line.qty * line.price).toFixed(2) : '0'}
                      </p>

                      {/* Remove */}
                      <button type="button" onClick={() => removeLine(idx)}
                        className="text-gray-300 hover:text-red-400 transition text-lg leading-none">
                        ×
                      </button>
                    </div>

                    {/* Dropdown */}
                    {line.open && results.length > 0 && (
                      <div className="absolute left-0 right-0 z-30 bg-white border border-gray-200 shadow-xl rounded-xl mt-0 max-h-64 overflow-y-auto">
                        {results.map(item => (
                          <button key={item.id} type="button"
                            onMouseDown={() => selectItem(idx, item)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <span className="text-xs text-gray-400">SOH: {item.soh} pcs</span>
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-xs text-gray-400">{item.group}</span>
                              <span className="text-xs font-semibold text-blue-600">₵ {item.selling_price.toFixed(2)}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add row */}
            <div className="px-3 py-2 border-t border-gray-100">
              <button type="button" onClick={addLine}
                className="text-sm text-blue-600 hover:text-blue-500 font-semibold transition">
                + Add New Row
              </button>
            </div>
          </div>
        </div>

        {/* Totals */}
        {filledLines.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Sub Total</span>
              <span>₵ {total.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2">
              <span>Total (₵)</span>
              <span>₵ {total.toFixed(2)}</span>
            </div>
          </div>
        )}

        <button type="submit" disabled={!filledLines.length || saving}
          className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-base transition">
          {saving ? 'Saving…' : 'Save Receipt'}
        </button>
      </form>
    </div>
  )
}
