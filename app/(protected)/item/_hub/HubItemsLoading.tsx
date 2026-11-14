'use client'
import type { HubCtx } from './useHubState'
import HubCatalogueGrid from './HubCatalogueGrid'

export default function HubItemsLoading({ h }: { h: HubCtx }) {
  const { items, liveAllItems, liveItemsLoading, setLiveItemsLoading, liveCurrentView, liveItemsError, loadLiveItems, liveCatalogueItems } = h
  return (<>{liveItemsLoading ? (
                  <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
                ) : liveAllItems.length === 0 && liveItemsError ? (
                  <div className="text-center py-8 space-y-2">
                    <p className="text-sm text-red-600">Couldn&apos;t load items.</p>
                    <button onClick={() => { setLiveItemsLoading(true); void loadLiveItems() }}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg">Try again</button>
                  </div>
                ) : liveCatalogueItems.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    {liveCurrentView ? 'No items in this view' : 'No items found'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-0 p-0">
                  {<HubCatalogueGrid h={h} />}
                  </div>
                )}</>)
}
