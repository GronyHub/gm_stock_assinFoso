'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type Item = { id: number; name: string; group: string; soh: number }
type Line = { item: Item; qty: number; price: number; vendorName: string }

export default function NewBillPage({ onSuccess }: { onSuccess?: () => void } = {}) {
  usePresenceReporter('entering a bill')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
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
    // Default the new line's vendor to whatever was last typed -- most
    // items entered in one sitting come from the same vendor, but it
    // stays fully editable per line.
    const lastVendor = lines.length ? lines[lines.length - 1].vendorName : ''
    setLines(p => [...p, { item, qty: 1, price: 0, vendorName: lastVendor }])
    setQuery('')
    setResults([])
  }
  function removeLine(i: number) { setLines(p => p.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, f: 'qty' | 'price', v: number) { setLines(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l)) }
  function updateVendor(i: number, v: string) { setLines(p => p.map((l, idx) => idx === i ? { ...l, vendorName: v } : l)) }
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!lines.length) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          lines: lines.map(l => ({
            itemId: l.item.id, itemName: l.item.name, qty: l.qty, price: l.price,
            total: l.qty * l.price, vendorName: l.vendorName.trim() || null,
          })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setSaving(false)
      if (res.ok) {
        setDone(true)
        setTimeout(() => onSuccess ? onSuccess() : router.push('/dashboard'), 1200)
      } else {
        setError(d.error || 'Could not save bill. Please try again.')
      }
    } catch {
      setSaving(false)
      setError('Network error — could not reach the server. Please try again.')
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-5xl mb-4">✓</p>
      <p className="text-gray-900 font-semibold text-lg">Bill saved!</p>
    </div>
  )

  return (
    <div className="py-4 max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">New Bill (Purchase)</h1>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>

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

        {lines.length > 0 && (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="bg-white border border-gray-300 rounded-xl p-4">
                <div className="flex justify-between mb-3">
                  <span className="text-gray-900 font-medium">{l.item.name}</span>
                  <button type="button" onClick={() => removeLine(i)}
                    className="text-gray-400 hover:text-red-400 text-sm px-2 py-1">Remove</button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {(['qty', 'price'] as const).map(f => (
                    <div key={f}>
                      <label className="text-xs text-gray-400 block mb-1">{f === 'price' ? 'Cost Price' : 'Qty'}</label>
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
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Vendor</label>
                  <input value={l.vendorName} onChange={e => updateVendor(i, e.target.value)} placeholder="Vendor name"
                    className="w-full bg-gray-100 rounded-lg px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none" />
                </div>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && <div className="text-right text-gray-900 font-bold text-xl py-1">Total: ₵ {total.toFixed(2)}</div>}

        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
        <button type="submit" disabled={!lines.length || saving}
          className="w-full bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-base transition">
          {saving ? 'Saving…' : 'Save Bill'}
        </button>
      </form>
    </div>
  )
}
