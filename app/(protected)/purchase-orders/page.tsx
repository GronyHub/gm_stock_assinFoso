'use client'
import { useState } from 'react'
import POTab from '../item/_components/POTab'

// Standalone home for PO -- moved out of the Grony Cash submenu row (same
// reasoning as Counts/Customers/Vendors/Receipts before it) into the
// account menu instead. Reuses POTab as-is, which is fully self-contained
// (fetches its own /api/purchase-orders data and handles viewing/editing a
// PO inline), so this page only needs to supply the search box POTab
// itself doesn't render.
export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState('')

  return (
    <div className="-mx-4 -mt-4 flex flex-col" style={{ height: 'calc(100dvh - 56px - 60px)' }}>
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-200 bg-white">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
      </div>
      <div className="flex-1 min-h-0">
        <POTab search={search} />
      </div>
    </div>
  )
}
