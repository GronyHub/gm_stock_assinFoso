'use client'
import { NewItemForm, AliasWidePage, ServiceMatchesPage, GmcPacksPage, LiveSaleAnalyticsSection, formatPrice, type Item, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'
import HubExtraViewSwitch from './HubExtraViewSwitch'
import HubSelectedItemPanel from './HubSelectedItemPanel'

export default function HubSaleModeBody({ h }: { h: HubCtx }) {
  const { violation, items, shop, liveAllItems, liveTaps, liveSaleType, liveCurrentView, setLiveCurrentView, liveEditingCountId, setLiveEditingCountId, liveEditCountQty, setLiveEditCountQty, liveEditCountNotes, setLiveEditCountNotes, liveEditCountSaving, setLiveEditCountSaving, saleModeShowAnalytics, liveComputedFlags, loadLiveItems, liveToday, liveCatalogueItems } = h
  return (<>{saleModeShowAnalytics ? (
              <div className="px-3 pt-3 flex-1 overflow-auto"><LiveSaleAnalyticsSection /></div>
            ) : (<>

            {/* GMC warning -- internal-use recording is easy to mis-tap and hard
                to catch afterward (it's excluded from revenue/margin and feeds
                the stock-gain reconciliation checks), so this stays loud and
                impossible to miss for as long as GMC is selected. */}
            {liveSaleType === 'GMC' && (
              <div className="px-4 py-3 bg-red-600 border-b-4 border-red-800">
                <p className="text-white font-extrabold text-lg leading-tight">
                  ⚠ GMC MODE — Internal Use, Not a Real Sale
                </p>
                <p className="text-red-50 text-xs font-semibold mt-1 leading-snug">
                  GMC ("Grony Multimedia as Customer") records stock the shop takes for its own internal use —
                  it is excluded from revenue and profit, and is used to explain stock changes that aren't
                  walk-in sales. Only tap items actually taken for internal use here. Switch back to WIC for
                  normal customer sales.
                </p>
              </div>
            )}

            {/* Current View Indicator */}
            {liveCurrentView && (
              <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-700">
                  {liveCurrentView.kind === 'violation' && `Viewing: Items with "${liveComputedFlags.find(f => f.key === liveCurrentView.key)?.label}"`}
                  {liveCurrentView.kind === 'lossByItem' && `Viewing: Loss by Item (${liveCatalogueItems.length} items)`}
                  {liveCurrentView.kind === 'aliasWide' && `Viewing: Alias Wide Table`}
                  {liveCurrentView.kind === 'serviceMatches' && `Viewing: Service Matches`}
                  {liveCurrentView.kind === 'gmcPacks' && `Viewing: GMC Packs`}
                  {liveCurrentView.kind === 'newItem' && `Creating New Item`}
                  {liveCurrentView.kind === 'dailySummary' && `Daily Sales Summary`}
                </span>
                <button
                  type="button"
                  onClick={() => setLiveCurrentView(null)}
                  className="text-xs font-semibold px-2 py-1 rounded bg-white text-blue-600 hover:bg-blue-100 transition"
                >
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Alias Wide Table View */}
            {liveCurrentView?.kind === 'aliasWide' && (
              <div className="flex-1 overflow-y-auto">
                <AliasWidePage />
              </div>
            )}

            {/* Service Matches View */}
            {liveCurrentView?.kind === 'serviceMatches' && (
              <div className="flex-1 overflow-y-auto">
                <ServiceMatchesPage />
              </div>
            )}

            {/* GMC Packs View */}
            {liveCurrentView?.kind === 'gmcPacks' && (
              <div className="flex-1 overflow-y-auto">
                <GmcPacksPage />
              </div>
            )}

            {/* Daily Summary View */}
            {liveCurrentView?.kind === 'dailySummary' && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {(() => {
                  try {
                    const validTaps = (liveTaps || []).filter((t): t is Tap => t != null && !t.undone)
                    const todayTaps = validTaps.filter(t => t.tapped_at.startsWith(liveToday))
                    const totalRevenue = (todayTaps || []).reduce((sum, t) => t ? sum + Number(t.price) * t.quantity : sum, 0)
                    const totalQuantity = todayTaps.reduce((sum, t) => sum + t.quantity, 0)
                    const uniqueItems = new Set(todayTaps.map(t => t.item_id)).size

                    const topItemsMap = new Map<number, number>()
                    for (const tap of todayTaps) {
                      topItemsMap.set(tap.item_id, (topItemsMap.get(tap.item_id) ?? 0) + tap.quantity)
                    }
                    const topItems = Array.from(topItemsMap.entries())
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)

                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-xs text-blue-600 font-semibold">Total Revenue</p>
                            <p className="text-2xl font-bold text-blue-900 mt-1">₵{formatPrice(totalRevenue)}</p>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <p className="text-xs text-green-600 font-semibold">Total Quantity</p>
                            <p className="text-2xl font-bold text-green-900 mt-1">{totalQuantity}</p>
                          </div>
                          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                            <p className="text-xs text-purple-600 font-semibold">Unique Items</p>
                            <p className="text-2xl font-bold text-purple-900 mt-1">{uniqueItems}</p>
                          </div>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-gray-600 mb-3">Top Items</p>
                          <div className="space-y-2">
                            {topItems.length === 0 ? (
                              <p className="text-xs text-gray-500">No sales today</p>
                            ) : (
                              topItems.map(([itemId, qty]) => {
                                const item = liveAllItems.find(i => i.id === itemId)
                                return (
                                  <div key={itemId} className="flex justify-between text-xs">
                                    <span className="text-gray-700">{item?.name || '?'}</span>
                                    <span className="font-semibold text-blue-600">{qty} units</span>
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  } catch (e) {
                    console.error('Daily summary error:', e)
                    return (
                      <div className="text-center py-8">
                        <p className="text-sm text-red-600 font-medium">Could not load daily summary</p>
                      </div>
                    )
                  }
                })()}
              </div>
            )}

            {/* New Item Form */}
            {liveCurrentView?.kind === 'newItem' && (
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <NewItemForm onSuccess={() => { setLiveCurrentView(null); void loadLiveItems() }} />
              </div>
            )}


            {/* Edit Count Modal */}
            {liveEditingCountId !== null && (
              <div className="fixed inset-0 z-[80] bg-black/40 flex items-center justify-center p-3">
                <div className="bg-white rounded-lg w-full max-w-sm shadow-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Count Record</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Quantity</label>
                      <input
                        type="number"
                        value={liveEditCountQty}
                        onChange={(e) => setLiveEditCountQty(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={liveEditCountNotes}
                        onChange={(e) => setLiveEditCountNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Add notes…"
                        rows={3}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => {
                        setLiveEditingCountId(null)
                        setLiveEditCountQty('')
                        setLiveEditCountNotes('')
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-semibold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setLiveEditCountSaving(true)
                        fetch(`/api/stock/counts/${liveEditingCountId}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            quantity_counted: liveEditCountQty,
                            notes: liveEditCountNotes
                          })
                        }).then(async (res) => {
                          setLiveEditCountSaving(false)
                          if (res.ok) {
                            const data = await res.json()
                            if (data.requires_loss_reason) {
                              alert(`${data.error}\n\nPlease confirm the loss reason separately.`)
                              setLiveEditingCountId(null)
                              setLiveEditCountQty('')
                              setLiveEditCountNotes('')
                            } else {
                              setLiveEditingCountId(null)
                              setLiveEditCountQty('')
                              setLiveEditCountNotes('')
                              // Refresh count records
                              window.location.reload()
                            }
                          } else {
                            const data = await res.json()
                            alert(`Update failed: ${data.error || 'Unknown error'}`)
                          }
                        }).catch(e => {
                          console.error('Edit failed:', e)
                          alert('Update failed: ' + e.message)
                          setLiveEditCountSaving(false)
                        })
                      }}
                      disabled={liveEditCountSaving}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold text-sm disabled:opacity-50"
                    >
                      {liveEditCountSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Grid or Loss Tables */}
            {<HubExtraViewSwitch h={h} />}

            {/* Modal */}
            {<HubSelectedItemPanel h={h} />}

            </>)}</>)
}
