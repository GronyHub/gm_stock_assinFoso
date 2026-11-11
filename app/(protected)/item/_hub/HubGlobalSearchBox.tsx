'use client'
import type { HubCtx } from './useHubState'
import HubGlobalSearchResults from './HubGlobalSearchResults'

export default function HubGlobalSearchBox({ h }: { h: HubCtx }) {
  const { globalSearchQuery, setGlobalSearchQuery, closeGlobalSearch, items } = h
  return (<><div onClick={e => e.stopPropagation()}
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input autoFocus value={globalSearchQuery} onChange={e => setGlobalSearchQuery(e.target.value)}
                placeholder="Search items, customers, vendors, sales, bills, announcements…"
                className="flex-1 min-w-0 text-sm outline-none" />
              <button onClick={closeGlobalSearch} className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none px-1">×</button>
            </div>
            <HubGlobalSearchResults h={h} />
          </div></>)
}
