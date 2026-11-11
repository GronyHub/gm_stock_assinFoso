'use client'
import { isOwnerLevel } from '@/lib/roles'
import { ItemEditForm } from '../_components/ItemEditForm'
import { ItemDetailErrorBoundary } from '../_components/ItemDetailErrorBoundary'
import { ItemDetailPanel, AliasPicker, MatchPicker, MergeItemPicker, LossTab, formatPrice, type Item, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubGridItemEditor({ h }: { h: HubCtx }) {
  const { items, groups, session, liveAllItems, liveEditingGridItemId, setLiveEditingGridItemId, liveGridEditSaleTapRef, liveGridEditQtyInputRef, liveGridEditLoading, liveGridEditError, liveGridEditAliases, setLiveGridEditAliases, liveGridEditMatches, setLiveGridEditMatches, liveGridEditRelationsOpen, setLiveGridEditRelationsOpen, liveGridEditConfirmDelete, setLiveGridEditConfirmDelete, liveGridEditDeleting, liveGridEditDeleteError, setLiveGridEditDeleteError, liveGridEditCountQty, setLiveGridEditCountQty, liveGridEditCountError, liveGridEditCountSaving, liveQty, setLiveQty, livePrice, setLivePrice, liveSaving, liveTapStatus, liveTapTime, setLiveTapTime, setLiveTapTimeTouched, liveEditForm, setLiveEditForm, liveEditCurrentCountInterval, liveEditCurrentSoh, liveEditSaving, showToast, liveOverdueItems, liveGmcItemIds, recordTap, liveEditGroups, liveEditAllItemsList, deleteGridEditItem, recordCountFromModal, saveConversionTargetOnly, saveGridEditItem } = h
  return (<>{liveEditingGridItemId != null && (() => {
            const editItem = liveAllItems.find(i => i.id === liveEditingGridItemId)
            return (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
                <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="px-2 py-1 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10 gap-2">
                    {liveGridEditRelationsOpen ? (
                      <input
                        value={liveEditForm.item_name}
                        onChange={e => setLiveEditForm({ ...liveEditForm, item_name: e.target.value })}
                        placeholder="Item name *"
                        className="min-w-0 flex-1 text-xs font-bold text-red-600 uppercase bg-red-50 border border-red-200 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-red-400"
                      />
                    ) : (
                      <h2 className="text-xs font-bold text-red-600 truncate">{editItem?.name.toUpperCase()}</h2>
                    )}
                    <button
                      type="button"
                      onClick={() => setLiveEditingGridItemId(null)}
                      className="text-gray-500 hover:text-gray-700 text-xl font-light"
                    >
                      ×
                    </button>
                  </div>
                  <div className="overflow-y-auto">
                    {editItem && !liveGridEditLoading && (
                      <div className="border-b border-gray-200 bg-gray-50 px-1.5 py-1">
                        {!liveGridEditRelationsOpen ? (
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex flex-wrap gap-1.5 flex-1 items-center text-[8px]">
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-600">Aliases:</span>
                                {liveGridEditAliases.length === 0 ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {liveGridEditAliases.map(a => (
                                      <span key={a.id} className="inline-block bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                                        {a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="font-semibold text-gray-600">
                                  {editItem.product_type === 'service' ? 'Goods used:' : 'Services used:'}
                                </span>
                                {liveGridEditMatches.length === 0 ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {liveGridEditMatches.map(m => (
                                      <span key={m.id} className="inline-block bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full text-[8px] font-semibold">
                                        {m.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setLiveGridEditRelationsOpen(true)}
                              className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 transition whitespace-nowrap">
                              ✎ Edit
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1.5">
                              <p className="text-[8px] font-bold text-blue-700 uppercase tracking-wide">Editing</p>
                              <button
                                onClick={saveGridEditItem}
                                disabled={liveEditSaving}
                                className="shrink-0 text-[8px] font-semibold px-1.5 py-0.5 rounded bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white transition whitespace-nowrap">
                                {liveEditSaving ? 'Saving…' : '✓ Save'}
                              </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                              <div className="min-w-0">
                                <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">Aliases</p>
                                <AliasPicker itemId={editItem.id} current={liveGridEditAliases} onChange={setLiveGridEditAliases} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">
                                  {editItem.product_type === 'service' ? 'Goods Used' : 'Services Used'}
                                </p>
                                <MatchPicker
                                  itemId={editItem.id}
                                  itemName={editItem.name}
                                  isService={editItem.product_type === 'service'}
                                  current={liveGridEditMatches}
                                  candidatePool={editItem.product_type === 'service' ? Array.from(liveGmcItemIds).map((id: number) => {
                                    const it = liveAllItems.find(i => i.id === id)
                                    return { item_id: id, item_name: it?.name ?? '', product_type: 'good' }
                                  }) : Array.from(liveGmcItemIds).map((id: number) => {
                                    const it = liveAllItems.find(i => i.id === id)
                                    return { item_id: id, item_name: it?.name ?? '', product_type: 'service' }
                                  })}
                                  onChange={setLiveGridEditMatches}
                                />
                              </div>
                              {isOwnerLevel(session?.user as any) && (
                                <div className="min-w-0">
                                  <p className="text-[7px] font-bold text-gray-600 mb-0.5 uppercase truncate">Merge</p>
                                  <MergeItemPicker
                                    itemId={editItem.id}
                                    itemName={editItem.name}
                                    typeLabel={editItem.product_type === 'service' ? 'service' : 'good'}
                                    mergePool={liveAllItems.filter(i => i.id !== editItem.id).map(i => ({
                                      item_id: i.id,
                                      item_name: i.name,
                                      product_type: i.product_type
                                    }))}
                                    onMerged={() => { setLiveGridEditRelationsOpen(false); setLiveEditingGridItemId(null) }} />
                                </div>
                              )}
                            </div>
                            {isOwnerLevel(session?.user as any) && (
                              <div className="flex justify-end">
                                {!liveGridEditConfirmDelete ? (
                                  <button
                                    onClick={() => setLiveGridEditConfirmDelete(true)}
                                    className="bg-gray-100 hover:bg-red-50 text-red-600 text-[8px] font-semibold rounded px-2 py-0.5 transition">
                                    Delete
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 flex-wrap justify-end">
                                    <p className="text-[8px] text-red-600">No sales/bills/counts?</p>
                                    <button
                                      onClick={deleteGridEditItem}
                                      disabled={liveGridEditDeleting}
                                      className="bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-[8px] font-semibold rounded px-2 py-0.5 transition">
                                      {liveGridEditDeleting ? 'Deleting…' : 'Confirm'}
                                    </button>
                                    <button
                                      onClick={() => { setLiveGridEditConfirmDelete(false); setLiveGridEditDeleteError('') }}
                                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[8px] font-semibold rounded">
                                      Cancel
                                    </button>
                                    {liveGridEditDeleteError && <p className="text-[8px] text-red-600 font-medium w-full text-right">{liveGridEditDeleteError}</p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="border-b border-gray-200">
                      {liveGridEditLoading ? (
                        <p className="text-center text-gray-500 text-xs py-2">Loading…</p>
                      ) : editItem ? (
                        <ItemEditForm
                          form={liveEditForm}
                          onChange={setLiveEditForm}
                          groups={liveEditGroups}
                          itemId={editItem.id}
                          isService={editItem.product_type === 'service'}
                          allItems={liveEditAllItemsList}
                          size="compact"
                          currentCountInterval={liveEditCurrentCountInterval}
                          currentSoh={liveEditCurrentSoh}
                          acp={editItem.acp_price}
                          onConversionTargetSave={saveConversionTargetOnly}
                          hideGmcTick
                          editMode={liveGridEditRelationsOpen}
                          onEditModeChange={setLiveGridEditRelationsOpen}
                          hideEditButton
                        />
                      ) : (
                        <p className="text-center text-red-600 text-xs py-2">Item not found</p>
                      )}
                      {liveGridEditError && (
                        <div className="mx-1.5 mb-1.5 bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-600 font-medium">
                          {liveGridEditError}
                        </div>
                      )}
                    </div>
                    {editItem && !liveGridEditLoading && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      return (
                      <div ref={liveGridEditSaleTapRef} className="px-2 py-1.5 border-b border-gray-200">
                        <p className="text-xs text-gray-500 mb-1">Backdate a sale (only if it wasn't tapped on the item card)</p>
                        {liveTapStatus.length > 0 && (
                          <div className="mb-1.5 p-1.5 bg-gray-50 border border-gray-200 rounded text-[8px] font-mono text-gray-600 max-h-24 overflow-y-auto">
                            {liveTapStatus.map((msg, i) => (
                              <div key={i}>{msg}</div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1 items-center">
                          <input
                            ref={liveGridEditQtyInputRef}
                            type="number"
                            inputMode="decimal"
                            min="1"
                            step="1"
                            value={liveQty}
                            onChange={e => setLiveQty(e.target.value)}
                            placeholder="Qty"
                            className="w-14 text-xs text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₵</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.01"
                              value={livePrice}
                              onChange={e => setLivePrice(e.target.value)}
                              placeholder={editItem ? formatPrice(editItem.selling_price) : 'Price'}
                              className="w-20 text-xs text-gray-900 bg-white border border-gray-300 rounded pl-4 pr-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          </div>
                          <input
                            type="datetime-local"
                            value={liveTapTime}
                            onChange={e => { setLiveTapTime(e.target.value); setLiveTapTimeTouched(true) }}
                            title="Only sent to the server if you actually change it -- otherwise the tap records the real current time."
                            className="flex-1 min-w-0 text-xs text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                          />
                          <button
                            onClick={async () => {
                              try {
                                await recordTap(editItem)
                              } catch (e) {
                                const err = e instanceof Error ? e.message : String(e)
                                console.error('[SALE TAP] Error:', err)
                                showToast(`Error: ${err}`, 'error')
                              }
                            }}
                            disabled={!liveQty || liveSaving}
                            className="shrink-0 px-2.5 py-1 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium rounded transition disabled:opacity-50">
                            {liveSaving ? '…' : 'Tap'}
                          </button>
                        </div>
                      </div>
                    )})()}
                    {editItem && !liveGridEditLoading && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      const currentCount = overdueItem ? Math.ceil(Number(overdueItem.calculated_soh)) : null
                      return (
                      <div className="px-2 py-1.5 border-b border-gray-200">
                        {overdueItem ? (
                          <>
                            <p className="text-xs text-red-600 font-medium mb-1">
                              ⚠ Count overdue{overdueItem.days_overdue != null ? ` (${overdueItem.days_overdue}d)` : ' (never counted)'} · system expects {currentCount}
                            </p>
                            <div className="flex gap-1 items-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="1"
                                value={liveGridEditCountQty}
                                onChange={e => setLiveGridEditCountQty(e.target.value)}
                                placeholder="Qty"
                                className="w-20 text-xs text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-red-400"
                                disabled={liveGridEditCountSaving}
                              />
                              <button
                                type="button"
                                onClick={() => recordCountFromModal()}
                                disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                className="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded transition disabled:opacity-50">
                                {liveGridEditCountSaving ? 'Saving…' : 'Save Count'}
                              </button>
                            </div>
                            {liveGridEditCountError && (
                              <p className="mt-1 text-[10px] text-red-600">{liveGridEditCountError}</p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-xs text-gray-500 mb-1">Count now (off-cycle) · current count {currentCount ?? '—'}</p>
                            <div className="flex gap-1 items-center">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="1"
                                value={liveGridEditCountQty}
                                onChange={e => setLiveGridEditCountQty(e.target.value)}
                                placeholder="Qty"
                                className="w-20 text-xs text-gray-900 bg-white border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={liveGridEditCountSaving}
                              />
                              <button
                                type="button"
                                onClick={() => recordCountFromModal()}
                                disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                className="shrink-0 px-2.5 py-1 bg-gray-700 hover:bg-gray-800 text-white text-xs font-medium rounded transition disabled:opacity-50">
                                {liveGridEditCountSaving ? 'Recording…' : 'Record'}
                              </button>
                            </div>
                            {liveGridEditCountError && (
                              <p className="mt-1 text-[10px] text-red-600">{liveGridEditCountError}</p>
                            )}
                          </>
                        )}
                      </div>
                    )})()}
                    {editItem && !liveGridEditLoading && (
                      <div className="bg-gray-50">
                        <h3 className="px-2 py-1 text-[9px] font-bold text-gray-900 border-b border-gray-200">Details</h3>
                        {/* Wraps the WHOLE panel, not just LossTab's own inner
                            boundary (which only covers <ItemDetail> itself) --
                            a crash anywhere in ItemDetailPanel's own body was
                            propagating past everything and blanking this
                            entire page instead of just this "Details"
                            section. Whatever the actual bug turns out to be,
                            this at least turns "blank white screen" into a
                            readable error message. */}
                        <ItemDetailErrorBoundary>
                          <ItemDetailPanel itemId={editItem.id} onItemGone={() => setLiveEditingGridItemId(null)} showRelationsEditor={false} />
                        </ItemDetailErrorBoundary>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}</>)
}
