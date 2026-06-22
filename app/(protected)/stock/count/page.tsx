'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: number; name: string; group: string; soh: number }

export default function StockCountPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Item[]>([])
  const [selected, setSelected] = useState<Item | null>(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || qty === '') return
    setSaving(true)
    const res = await fetch('/api/stock/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: selected.id, qty: Number(qty), notes }),
    })
    setSaving(false)
    if (res.ok) { setDone(true); setTimeout(() => router.push(`/stock/${selected.id}`), 1200) }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-4xl mb-3">âœ…</p>
      <p className="text-white font-semibold">Count saved!</p>
      <p className="text-gray-400 text-sm mt-1">Redirecting to itemâ€¦</p>
    </div>
  )

  return (
    <div className="py-6 max-w-lg space-y-6">
      <h1 className="text-xl font-bold">Enter Stock Count</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Item search */}
        <div className="relative">
          <label className="text-sm text-gray-400 block mb-1">Item</label>
          <input
            value={selected ? selected.name : query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            placeholder="Search item nameâ€¦"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {results.length > 0 && !selected && (
            <ul className="absolute z-20 w-full bg-gray-900 border border-gray-700 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-xl">
              {results.map(item => (
                <li key={item.id}>
                  <button type="button"
                    onClick={() => { setSelected(item); setQuery(''); setResults([]) }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-800 text-sm transition">
                    <span className="text-white">{item.name}</span>
                    <span className="text-gray-500 ml-2 text-xs">{item.group}</span>
                    <span className="text-gray-500 ml-2 text-xs">SOH: {item.soh}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && (
          <div className="bg-blue-950 border border-blue-800 rounded-lg p-3 text-sm">
            <span className="text-blue-300 font-medium">{selected.name}</span>
            <span className="text-gray-400 ml-3">Current SOH: {selected.soh}</span>
            <button type="button" onClick={() => setSelected(null)} className="float-right text-gray-500 hover:text-white">âœ•</button>
          </div>
        )}

        <div>
          <label className="text-sm text-gray-400 block mb-1">Counted Quantity</label>
          <input
            type="number" min="0" step="any"
            value={qty} onChange={e => setQty(e.target.value)}
            placeholder="0"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Notes (optional)</label>
          <input
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. counted after closing"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button type="submit" disabled={!selected || qty === '' || saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold rounded-lg py-3 text-sm transition">
          {saving ? 'Savingâ€¦' : 'Save Count'}
        </button>
      </form>
    </div>
  )
}

