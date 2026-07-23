'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

type Item = { id: number; item_name: string; cf_group: string | null }

// Search bar + dropdown for jumping from one item's 360 page straight to
// another's, without going back through Gd/Srv/Sales/Bills to find it.
// Typing filters the dropdown; an empty, focused box shows the first items
// alphabetically so it also works as a plain browse-and-pick dropdown.
export default function ItemSwitcher({ currentItemId }: { currentItemId: number }) {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/items').then(r => r.json())
      .then(d => setItems(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = (q ? items.filter(i => i.item_name.toLowerCase().includes(q)) : items)
    .filter(i => i.id !== currentItemId)
    .slice(0, 25)

  function go(item: Item) {
    setQuery('')
    setOpen(false)
    router.push(`/stock/${item.id}`)
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Switch to another item…"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {matches.map(i => (
            <button key={i.id} onClick={() => go(i)}
              className="w-full text-left px-3 py-2 text-sm text-gray-800 hover:bg-blue-50 border-b border-gray-100 last:border-0">
              {i.item_name}
              {i.cf_group && <span className="text-gray-400 text-xs ml-1.5">· {i.cf_group}</span>}
            </button>
          ))}
        </div>
      )}
      {open && q && matches.length === 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          No matching items
        </div>
      )}
    </div>
  )
}
