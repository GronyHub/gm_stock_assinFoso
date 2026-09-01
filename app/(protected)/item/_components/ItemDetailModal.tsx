'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect, Component, ReactNode } from 'react'

const ItemDetailPanel = dynamic(() => import('./ItemDetailPanel'), { ssr: false })

// Error boundary to catch rendering errors for problematic items
class ErrorBoundary extends Component<{ children: ReactNode; itemId: number }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(e: any) {
    console.error(`[ItemDetailModal] Render error for item #${this.props.itemId}:`, e)
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 text-red-600 text-sm">Unable to load this item's details</div>
    }
    return this.props.children
  }
}

// The bottom-sheet chrome around ItemDetailPanel -- first built for Live
// Sale's own "tap an item's name" popup, now the shared way any page opens
// an item's full detail (loss/gain history, pack-chain, aliases, merge)
// in place instead of navigating to the Loss by Item page, which no
// longer exists as its own destination.
export default function ItemDetailModal({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  const [itemName, setItemName] = useState<string>('')

  useEffect(() => {
    fetch('/api/losses/summary')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const item = d.find((i: any) => i.item_id === itemId)
          if (item) setItemName(item.item_name)
        }
      })
      .catch(() => {})
  }, [itemId])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <p className="text-lg font-bold text-red-600 truncate">{itemName}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl font-bold leading-none flex items-center justify-center transition"
          >
            ×
          </button>
        </div>
        <ErrorBoundary itemId={itemId}>
          <ItemDetailPanel itemId={itemId} onItemGone={onClose} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
