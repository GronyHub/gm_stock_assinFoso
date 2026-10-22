'use client'
import { useRef, useState } from 'react'

export type ItemHit = { id: number; name: string; group: string | null; soh: number | string; selling_price: number | string }

// Item / service box that lists matching items (from the active items) as you type, or all of
// them when you tap the empty box. Picking one fills the name and the selling price.
export default function ItemSuggest({ value, onType, onPick, className, placeholder }: {
  value: string; onType: (text: string) => void; onPick: (hit: ItemHit) => void; className?: string; placeholder?: string
}) {
  const [hits, setHits] = useState<ItemHit[]>([])
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)

  function search(q: string) {
    const my = ++seq.current
    setTimeout(async () => {
      if (my !== seq.current) return
      try {
        const r = await fetch(`/api/items/search?q=${encodeURIComponent(q)}`)
        const d = await r.json()
        if (my !== seq.current || !Array.isArray(d)) return
        const b = inputRef.current?.getBoundingClientRect()
        if (b) setPos({ left: b.left, top: b.bottom + 2, width: b.width })
        setHits(d.slice(0, 10))
      } catch { /* ignore */ }
    }, 200)
  }

  return (
    <>
      <input ref={inputRef} value={value} placeholder={placeholder} className={className} autoComplete="off"
        onChange={e => { onType(e.target.value); search(e.target.value) }}
        onFocus={() => search(value)}
        onBlur={() => setTimeout(() => { seq.current++; setHits([]) }, 150)} />
      {hits.length > 0 && pos && (
        <div style={{ position: 'fixed', left: pos.left, top: pos.top, width: pos.width }}
          className="z-[200] max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {hits.map(h => (
            <button key={h.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { seq.current++; setHits([]); onPick(h) }}
              className="flex w-full items-center justify-between gap-2 border-b border-gray-100 px-3 py-2 text-left last:border-0 hover:bg-blue-50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-gray-900">{h.name}</span>
                {h.group && <span className="block truncate text-[10px] text-gray-500">{h.group}</span>}
              </span>
              <span className="shrink-0 text-xs font-bold text-gray-700">₵{Number(h.selling_price).toLocaleString('en-GB', { maximumFractionDigits: 2 })}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
