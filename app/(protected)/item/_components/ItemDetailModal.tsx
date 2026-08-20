'use client'
import dynamic from 'next/dynamic'

const ItemDetailPanel = dynamic(() => import('./ItemDetailPanel'), { ssr: false })

// The bottom-sheet chrome around ItemDetailPanel -- first built for Live
// Sale's own "tap an item's name" popup, now the shared way any page opens
// an item's full detail (loss/gain history, pack-chain, aliases, merge)
// in place instead of navigating to the Loss by Item page, which no
// longer exists as its own destination.
export default function ItemDetailModal({ itemId, onClose }: { itemId: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h3 className="text-sm font-bold text-gray-900">Item Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 text-xl font-bold leading-none flex items-center justify-center transition"
          >
            ×
          </button>
        </div>
        <ItemDetailPanel itemId={itemId} />
      </div>
    </div>
  )
}
