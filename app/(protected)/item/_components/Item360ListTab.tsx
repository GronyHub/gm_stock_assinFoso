'use client'
import { useState } from 'react'
import ItemDetailPanel from './ItemDetailPanel'

type Item = { id: number; item_name: string; cf_group: string | null }

export default function Item360ListTab({ items }: { items: Item[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set())

  function toggleExpand(itemId: number) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const sortedItems = [...items].sort((a, b) => a.item_name.localeCompare(b.item_name))

  return (
    <div className="space-y-4">
      {sortedItems.map(item => (
        <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <ItemDetailPanel
            itemId={item.id}
            collapsed={!expandedIds.has(item.id)}
            onExpand={() => toggleExpand(item.id)}
          />
        </div>
      ))}
    </div>
  )
}
