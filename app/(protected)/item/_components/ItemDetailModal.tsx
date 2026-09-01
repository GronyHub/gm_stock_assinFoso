'use client'
import dynamic from 'next/dynamic'
import { useState, useEffect, Component, ReactNode } from 'react'

const ItemDetailPanel = dynamic(() => import('./ItemDetailPanel'), { ssr: false })

// Error boundary to catch rendering errors for problematic items
class ErrorBoundary extends Component<{ children: ReactNode; itemId: number }, { hasError: boolean; errorMsg: string }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: any) {
    return {
      hasError: true,
      errorMsg: error?.message || String(error) || 'Unknown render error'
    }
  }
  componentDidCatch(e: any) {
    console.error(`[ItemDetailModal] Render error for item #${this.props.itemId}:`, e)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-red-700 text-sm font-semibold mb-1">Render Error</p>
          <p className="text-red-600 text-xs whitespace-pre-wrap break-words">{this.state.errorMsg}</p>
          <p className="text-red-500 text-xs mt-2">Item #: {this.props.itemId}</p>
        </div>
      )
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
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetch('/api/losses/summary')
      .then(r => {
        if (!r.ok) throw new Error(`API error: ${r.status} ${r.statusText}`)
        return r.json()
      })
      .then(d => {
        if (Array.isArray(d)) {
          const item = d.find((i: any) => i.item_id === itemId)
          if (item) setItemName(item.item_name)
        } else {
          setError(`Invalid response: expected array, got ${typeof d}`)
        }
      })
      .catch((err: any) => {
        setError(`Error loading item: ${err?.message || 'Unknown error'}`)
      })
  }, [itemId])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <p className="text-lg font-bold text-red-600 truncate">{itemName || `Item #${itemId}`}</p>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl font-bold leading-none flex items-center justify-center transition"
          >
            ×
          </button>
        </div>
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-700 text-sm font-semibold mb-1">Error</p>
            <p className="text-red-600 text-xs whitespace-pre-wrap break-words">{error}</p>
          </div>
        )}
        <ErrorBoundary itemId={itemId}>
          <ItemDetailPanel itemId={itemId} onItemGone={onClose} />
        </ErrorBoundary>
      </div>
    </div>
  )
}
