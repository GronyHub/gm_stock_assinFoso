'use client'
import { useState, useMemo, useEffect } from 'react'
import ItemDetailPanel from './ItemDetailPanel'
import Item360ListTab from './Item360ListTab'

type Item = { id: number; item_name: string; cf_group: string | null }

// Item 360 as its own Grony Cash left-pane destination -- search for any
// item, then see its full pack-chain/edit/alias/merge detail (the same
// ItemDetailPanel the standalone /stock/[id] route used to render, before
// that route was removed in favor of this one canonical destination),
// without leaving the Grony Cash shell the way that route did. Reuses the
// items list the shell already has loaded rather than fetching its own
// copy. `jumpToItemId` lets every other "tap an item" spot in the app
// (Items list, Sales/Bills lines, item/page.tsx's own jumpItemId URL param)
// land straight on that item's detail instead of the search box. When no
// jumpToItemId is provided, shows all items' 360s collapsed to 10 rows each.
export default function Item360Tab({ items, jumpToItemId, onJumpDone }: {
  items: Item[]; jumpToItemId?: number | null; onJumpDone?: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(jumpToItemId ?? null)

  useEffect(() => {
    if (jumpToItemId == null) return
    setSelectedId(jumpToItemId)
    onJumpDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToItemId])

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? items.filter(i => i.item_name.toLowerCase().includes(q)) : items
    return [...list].sort((a, b) => a.item_name.localeCompare(b.item_name)).slice(0, 50)
  }, [items, search])

  // Show single item detail when a specific item is selected
  if (selectedId != null) {
    return (
      <div className="px-2 pt-1 space-y-1">
        <button onClick={() => setSelectedId(null)}
          className="text-[7px] font-semibold text-blue-600 hover:underline">
          ← View all items
        </button>
        <ItemDetailPanel itemId={selectedId} />
      </div>
    )
  }

  // Show search UI when user is searching
  if (search.trim()) {
    return (
      <div className="px-2 pt-1 space-y-1">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search items…" autoFocus
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
          {matches.length === 0 && (
            <p className="px-2 py-2 text-xs text-gray-400 text-center">No matching items</p>
          )}
          {matches.map(i => (
            <button key={i.id} onClick={() => setSelectedId(i.id)}
              className="w-full text-left px-2 py-1 text-xs text-gray-800 hover:bg-blue-50 transition">
              {i.item_name}
              {i.cf_group && <span className="text-gray-400 text-[10px] ml-1">· {i.cf_group}</span>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Default: show all items with collapsed 360s
  return (
    <div className="px-2 pt-1 space-y-1">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search items…" autoFocus
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-400" />
      <Item360ListTab items={items} />
    </div>
  )
}
