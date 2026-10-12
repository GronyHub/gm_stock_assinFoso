'use client'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { ItemDetailErrorBoundary } from './ItemDetailErrorBoundary'

const ItemDetailPanel = dynamic(() => import('./ItemDetailPanel'), {
  ssr: false,
  loading: () => <p className="text-xs text-gray-400 text-center py-8">Loading…</p>,
})

type Hit = { id: number; name: string; group: string | null; soh: number | string; selling_price: number | string }

// Standalone Item 360: search any item, then see its full detail (pack chain,
// edit, aliases, merge, loss/gain history). Search uses /api/items/search,
// which reads active_items, so merged-away duplicates can't be picked.
export default function Item360Page() {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setHits([]); setError(false); return }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`)
        const d = r.ok ? await r.json() : null
        if (Array.isArray(d)) { setHits(d); setError(false) } else setError(true)
      } catch { setError(true) }
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="px-4 pt-3 pb-10 space-y-3">
      <h1 className="text-lg font-bold text-gray-900">Item 360</h1>
      <input
        type="text" value={query} onChange={e => { setQuery(e.target.value); setSelected(null) }}
        placeholder="Search an item by name or group…"
        className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      {!selected && (
        <div className="space-y-1">
          {error && <p className="text-sm text-red-600">Couldn&apos;t search. Check your connection and try again.</p>}
          {searching && <p className="text-xs text-gray-400">Searching…</p>}
          {!searching && !error && query.trim().length >= 2 && hits.length === 0 && (
            <p className="text-xs text-gray-400">No items found.</p>
          )}
          {hits.map(h => (
            <button key={h.id} type="button" onClick={() => setSelected({ id: h.id, name: h.name })}
              className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50">
              <span className="text-sm font-semibold text-gray-900">{h.name}</span>
              <span className="block text-[11px] text-gray-500">
                {h.group ?? 'No group'} · SOH {Number(h.soh)} · ₵{Number(h.selling_price)}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className="space-y-2">
          <button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-blue-600">← Back to results</button>
          <ItemDetailErrorBoundary>
            <ItemDetailPanel itemId={selected.id} onItemGone={() => setSelected(null)} />
          </ItemDetailErrorBoundary>
        </div>
      )}
    </div>
  )
}
