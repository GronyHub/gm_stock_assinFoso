'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: number; name: string; group: string; soh: number }
type Line = { item: Item; qty: number; price: number }

export default function NewReceiptPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [cashCounted, setCashCounted] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState('')
  const router = useRouter()
  const debounce = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    clearTimeout(debounce.current ?? undefined)
    debounce.current = setTimeout(async () => {
      const r = await fetch(`/api/items/search?q=${encodeURIComponent(query)}`)
      setResults(await r.json())
    }, 250)
  }, [query])

  function addItem(item: Item) {
    setLines(prev => [...prev, { item, qty: 1, price: 0 }])
    setQuery(''); setResults([])
  }
  function removeLine(i: number) { setLines(prev => prev.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: 'qty' | 'price', val: number) {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l))
  }

  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lines.length) return
    setSaving(true)
    const res = await fetch('/api/sales/receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, cashCounted: cashCounted ? Number(cashCounted) : null, lines:
        lines.map(l => ({ itemId: l.item.id, itemName: l.item.name, qty: l.qty, price: l.price, total: l.qty * l.price })) }),
    })
    setSaving(false)
    if (res.ok) {
      const d = await res.json()
      setDone(d.receiptNumber)
      setTimeout(() => router.push('/dashboard'), 1500)
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-4xl mb-3">âœ…</p>
      <p className="text-white font-semibold">Receipt {done} saved!</p>
    </div>
  )

  return (
    <div className="py-6 max-w-lg space-y-5">
      <h1 className="text-xl font-bold">New Sales Receipt</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Cash Counted (GHS)</label>
            <input type="number" step="0.01" value={cashCounted} onChange={e => setCashCounted(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Item search */}
        <div className="relative">
          <label className="text-sm text-gray-400 block mb-1">Add Item</label>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search item name or groupâ€¦"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
          {results.length > 0 && (
            <ul className="absolute z-20 w-full bg-gray-900 border border-gray-700 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-xl">
              {results.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => addItem(item)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-800 text-sm transition">
                    <span className="text-white">{item.name}</span>
                    <span className="text-gray-500 ml-2 text-xs">{item.group}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lines */}
        {lines.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm text-gray-400">Items</label>
            {lines.map((l, i) => (
              <div key={i} className="bg-gray-900 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{l.item.name}</span>
                  <button type="button" onClick={() => removeLine(i)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Qty</label>
                    <input type="number" min="0.01" step="any" value={l.qty}
                      onChange={e => updateLine(i, 'qty', Number(e.target.value))}
                      className="w-full bg-gray-800 rounded px-2 py-1.5 text-sm text-white outline-none mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Unit Price</label>
                    <input type="number" min="0" step="0.01" value={l.price}
                      onChange={e => updateLine(i, 'price', Number(e.target.value))}
                      className="w-full bg-gray-800 rounded px-2 py-1.5 text-sm text-white outline-none mt-0.5" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Total</label>
                    <p className="text-sm text-white mt-1.5 font-medium">GHS {(l.qty * l.price).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ))}
            <div className="text-right text-white font-bold text-lg">Total: GHS {total.toFixed(2)}</div>
          </div>
        )}

        <button type="submit" disabled={!lines.length || saving}
          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-semibold rounded-lg py-3 text-sm transition">
          {saving ? 'Savingâ€¦' : 'Save Receipt'}
        </button>
      </form>
    </div>
  )
}

