'use client'
import { useState, useEffect } from 'react'
import ItemDetailPanel from './ItemDetailPanel'
import LossByItemTab from './LossByItemTab'

// Item 360 as its own Grony Cash left-pane destination -- search for any
// item, then see its full pack-chain/edit/alias/merge detail (the same
// ItemDetailPanel the standalone /stock/[id] route used to render, before
// that route was removed in favor of this one canonical destination),
// without leaving the Grony Cash shell the way that route did.
// `jumpToItemId` lets every other "tap an item" spot in the app (Items
// list, Sales/Bills lines, item/page.tsx's own jumpItemId URL param) land
// straight on that item's detail instead of the landing table below.
//
// The landing table is LossByItemTab -- Loss by Item used to be its own
// separate destination, but it's really just Item 360's item-name/loss-
// count/loss-amount ranking with a row click landing on the exact same
// detail panel this page already shows, so it lives here now instead of
// being duplicated as its own row.
export default function Item360Tab({ jumpToItemId, onJumpDone }: {
  jumpToItemId?: number | null; onJumpDone?: () => void
}) {
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(jumpToItemId ?? null)

  useEffect(() => {
    if (jumpToItemId == null) return
    setSelectedId(jumpToItemId)
    onJumpDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToItemId])

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

  return (
    <div className="px-2 pt-1 h-full min-h-0 flex flex-col">
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search items…" autoFocus
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-blue-400 mb-1" />
      <div className="flex-1 min-h-0">
        <LossByItemTab search={search} onSelectItem={setSelectedId} />
      </div>
    </div>
  )
}
