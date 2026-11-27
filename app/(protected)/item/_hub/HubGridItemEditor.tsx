'use client'
import { useEffect, useState } from 'react'
import { isOwnerLevel } from '@/lib/roles'
import { ItemEditForm } from '../_components/ItemEditForm'
import { ItemDetailErrorBoundary } from '../_components/ItemDetailErrorBoundary'
import ItemLossHistory from '../_components/ItemLossHistory'
import ItemPicture from '../_components/ItemPicture'
import ItemBarcodes from '../_components/ItemBarcodes'
import { ItemDetailPanel, AliasPicker, MatchPicker, MergeItemPicker, LossTab, formatPrice, type Item, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'

// The item sheet: full screen on a phone, a pop-up from 640px wide. Four tabs so nothing is one long scroll:
// Overview (the facts), Stock (count, backdate a sale, history), Links (aliases, services used, merge, barcodes), Photo.
type Tab = 'overview' | 'stock' | 'links' | 'photo'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'stock', label: 'Stock' },
  { key: 'links', label: 'Links' },
  { key: 'photo', label: 'Photo' },
]

export default function HubGridItemEditor({ h }: { h: HubCtx }) {
  const [tab, setTab] = useState<Tab>('overview')
  const [showAliases, setShowAliases] = useState(false)
  const { liveCountStatus, openEditGridItem, items, groups, session, liveAllItems, liveEditingGridItemId, setLiveEditingGridItemId, liveGridEditSaleTapRef, liveGridEditQtyInputRef, liveGridEditLoading, liveGridEditError, liveGridEditAliases, setLiveGridEditAliases, liveGridEditMatches, setLiveGridEditMatches, liveGridEditRelationsOpen, setLiveGridEditRelationsOpen, liveGridEditConfirmDelete, setLiveGridEditConfirmDelete, liveGridEditDeleting, liveGridEditDeleteError, setLiveGridEditDeleteError, liveGridEditCountQty, setLiveGridEditCountQty, liveGridEditCountError, liveGridEditCountSaving, liveQty, setLiveQty, livePrice, setLivePrice, liveSaving, liveTapStatus, liveTapTime, setLiveTapTime, setLiveTapTimeTouched, liveEditForm, setLiveEditForm, liveEditCurrentCountInterval, liveEditCurrentSoh, liveEditSaving, showToast, liveOverdueItems, liveGmcItemIds, recordTap, liveEditGroups, liveEditAllItemsList, deleteGridEditItem, recordCountFromModal, saveConversionTargetOnly, saveGridEditItem, liveGridEditStartTab, setLiveGridEditStartTab } = h
  // A different item opens on Overview, or on Photo when it was opened from a tile's photo strip.
  useEffect(() => { setTab(liveGridEditStartTab); setLiveGridEditStartTab('overview'); setShowAliases(false) }, [liveEditingGridItemId])
  return (<>{liveEditingGridItemId != null && (() => {
            const editItem = liveAllItems.find(i => i.id === liveEditingGridItemId)
            const ownerLevel = isOwnerLevel(session?.user as any)
            const ready = !!editItem && !liveGridEditLoading
            return (
              <div className="fixed inset-0 z-[70] flex items-stretch justify-center bg-black/50 sm:items-center sm:p-2">
                <div className="h-full w-full overflow-y-auto bg-white shadow-xl sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
                  <div className="sticky top-0 z-10 border-b border-gray-200 bg-white">
                    <div className="flex items-center gap-2 px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:pt-2">
                      <button type="button" onClick={() => setLiveEditingGridItemId(null)} aria-label="Back"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl text-gray-700 hover:bg-gray-100 sm:hidden">←</button>
                      {liveGridEditRelationsOpen ? (
                        <input
                          value={liveEditForm.item_name}
                          onChange={e => setLiveEditForm({ ...liveEditForm, item_name: e.target.value })}
                          placeholder="Item name *"
                          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-base font-bold text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      ) : (
                        <h2 className="min-w-0 flex-1 truncate text-base font-bold text-gray-900">{editItem?.name}</h2>
                      )}
                      {ready && (liveGridEditRelationsOpen ? (
                        <button type="button" onClick={saveGridEditItem} disabled={liveEditSaving}
                          className="shrink-0 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50">
                          {liveEditSaving ? 'Saving…' : '✓ Save'}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setLiveGridEditRelationsOpen(true)}
                          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                          ✎ Edit
                        </button>
                      ))}
                      <button type="button" onClick={() => setLiveEditingGridItemId(null)} aria-label="Close"
                        className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl font-light text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:flex">×</button>
                    </div>
                    <div role="tablist" aria-label="Item sections" className="flex">
                      {TABS.map(t => (
                        <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                          className={`flex-1 border-b-2 px-2 py-3 text-sm font-semibold transition ${tab === t.key ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-y-auto" role="tabpanel">
                    {/* ── Overview: the facts ── */}
                    {tab === 'overview' && (
                      <div className="border-b border-gray-200">
                        {liveGridEditLoading ? (
                          <p className="py-4 text-center text-sm text-gray-500">Loading…</p>
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
                          <p className="py-4 text-center text-sm text-red-600">Item not found</p>
                        )}
                        {liveGridEditError && (
                          <div className="mx-2 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-sm font-medium text-red-600">
                            {liveGridEditError}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Stock: count now, backdate a sale, history ── */}
                    {tab === 'stock' && ready && editItem && (() => {
                      const overdueItem = liveOverdueItems.find(i => i.item_id === editItem.id)
                      const currentCount = overdueItem ? Math.ceil(Number(overdueItem.calculated_soh)) : null
                      return (
                        <div>
                          <div className="border-b border-gray-200 px-3 py-3">
                            {overdueItem ? (
                              <>
                                <p className="mb-2 text-sm font-medium text-red-600">
                                  ⚠ Count overdue{overdueItem.days_overdue != null ? ` (${overdueItem.days_overdue}d)` : ' (never counted)'} · system expects {currentCount}
                                </p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number" inputMode="decimal" min="0" step="1"
                                    value={liveGridEditCountQty}
                                    onChange={e => setLiveGridEditCountQty(e.target.value)}
                                    placeholder="Qty"
                                    className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-red-400"
                                    disabled={liveGridEditCountSaving}
                                  />
                                  <button type="button" onClick={() => recordCountFromModal()} disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                    className="shrink-0 rounded bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
                                    {liveGridEditCountSaving ? 'Saving…' : 'Save Count'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <p className="mb-2 text-sm font-semibold text-gray-700">Count now <span className="font-normal text-gray-500">· off-cycle · current count {currentCount ?? '—'}</span></p>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number" inputMode="decimal" min="0" step="1"
                                    value={liveGridEditCountQty}
                                    onChange={e => setLiveGridEditCountQty(e.target.value)}
                                    placeholder="Qty"
                                    className="w-24 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                                    disabled={liveGridEditCountSaving}
                                  />
                                  <button type="button" onClick={() => recordCountFromModal()} disabled={!liveGridEditCountQty || liveGridEditCountSaving}
                                    className="shrink-0 rounded bg-gray-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50">
                                    {liveGridEditCountSaving ? 'Recording…' : 'Record'}
                                  </button>
                                </div>
                              </>
                            )}
                            {liveGridEditCountError && <p className="mt-1 text-sm text-red-600">{liveGridEditCountError}</p>}
                            {(() => {
                              // The next item that is due for a count (the most overdue first), so counting runs in a sequence without going back to a list.
                              const todo = [...liveCountStatus.entries()].filter(([id]) => id !== editItem.id).sort((a, b) => (b[1].level === 'overdue' ? 1 : 0) - (a[1].level === 'overdue' ? 1 : 0) || (b[1].days_overdue ?? 0) - (a[1].days_overdue ?? 0))
                              if (todo.length === 0) return <p className="mt-2 text-[13px] font-semibold text-green-700">Nothing else is due for a count.</p>
                              const [nid, st] = todo[0], nm = liveAllItems.find(i => i.id === nid)?.name ?? 'next item'
                              return <button type="button" onClick={() => { setLiveGridEditStartTab('stock'); openEditGridItem(nid) }} className="mt-2 flex w-full items-center justify-between gap-2 rounded-lg bg-blue-50 px-3 py-2 text-left text-[13px] font-bold text-blue-800"><span className="min-w-0 truncate">Next to count: {nm}</span><span className="shrink-0 text-[12px] font-semibold text-blue-600">{st.label} · {todo.length} left →</span></button>
                            })()}
                          </div>

                          <div ref={liveGridEditSaleTapRef} className="border-b border-gray-200 px-3 py-3">
                            <p className="mb-1 text-sm font-semibold text-gray-700">Backdate a sale</p>
                            <p className="mb-2 text-[13px] text-gray-500">Only if it wasn&apos;t tapped on the item card.</p>
                            {liveTapStatus.length > 0 && (
                              <div className="mb-2 max-h-24 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-1.5 font-mono text-[12px] text-gray-600">
                                {liveTapStatus.map((msg, i) => (<div key={i}>{msg}</div>))}
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={liveGridEditQtyInputRef}
                                type="number" inputMode="decimal" min="1" step="1"
                                value={liveQty}
                                onChange={e => setLiveQty(e.target.value)}
                                placeholder="Qty"
                                className="w-16 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <div className="relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">₵</span>
                                <input
                                  type="number" inputMode="decimal" min="0" step="0.01"
                                  value={livePrice}
                                  onChange={e => setLivePrice(e.target.value)}
                                  placeholder={editItem ? formatPrice(editItem.selling_price) : 'Price'}
                                  className="w-24 rounded border border-gray-300 bg-white py-1.5 pl-5 pr-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                                />
                              </div>
                              <input
                                type="datetime-local"
                                value={liveTapTime}
                                onChange={e => { setLiveTapTime(e.target.value); setLiveTapTimeTouched(true) }}
                                title="Only sent to the server if you actually change it -- otherwise the tap records the real current time."
                                className="min-w-[10rem] flex-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
                              />
                              <button
                                onClick={async () => {
                                  try { await recordTap(editItem) } catch (e) {
                                    const err = e instanceof Error ? e.message : String(e)
                                    console.error('[SALE TAP] Error:', err)
                                    showToast(`Error: ${err}`, 'error')
                                  }
                                }}
                                disabled={!liveQty || liveSaving}
                                className="shrink-0 rounded bg-gray-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50">
                                {liveSaving ? '…' : 'Tap'}
                              </button>
                            </div>
                          </div>

                          <ItemLossHistory itemId={editItem.id} />

                          <div className="bg-gray-50">
                            <h3 className="border-b border-gray-200 px-3 py-2 text-sm font-bold text-gray-900">History</h3>
                            {/* Wraps the WHOLE panel, not just LossTab's own inner boundary: a crash anywhere in
                                ItemDetailPanel's body was blanking this entire page instead of just this section. */}
                            <ItemDetailErrorBoundary>
                              <ItemDetailPanel itemId={editItem.id} onItemGone={() => setLiveEditingGridItemId(null)} showRelationsEditor={false} hidePicture hideBarcodes />
                            </ItemDetailErrorBoundary>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ── Links: aliases, services used (goods used), merge, delete, barcodes ── */}
                    {tab === 'links' && ready && editItem && (
                      <div>
                        <div className="border-b border-gray-200 bg-gray-50 px-3 py-3">
                          {!liveGridEditRelationsOpen ? (
                            <div className="space-y-2 text-[14px]">
                              {(() => {
                                // The same name saved twice shows once; names marked old are faded.
                                const uniq = Array.from(new Map(liveGridEditAliases.map(x => [x.name.trim().toLowerCase(), x])).values())
                                return uniq.length === 0 ? (
                                  <p className="text-gray-500"><span className="font-semibold text-gray-700">Aliases:</span> none</p>
                                ) : (
                                  <div>
                                    <button type="button" onClick={() => setShowAliases(v => !v)} aria-expanded={showAliases} className="flex items-center gap-1 font-semibold text-gray-700">
                                      Aliases ({uniq.length}) <span className="text-gray-400">{showAliases ? '▾' : '▸'}</span>
                                    </button>
                                    {showAliases && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {uniq.map(a => (
                                          <span key={a.id} className={`inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${/\bold\b/i.test(a.name) ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'}`}>
                                            {a.name}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )
                              })()}
                              <div className="flex flex-wrap items-center gap-1">
                                <span className="font-semibold text-gray-700">
                                  {editItem.product_type === 'service' ? 'Goods used:' : 'Services used:'}
                                </span>
                                {liveGridEditMatches.length === 0 ? (
                                  <span className="text-gray-400">none</span>
                                ) : (
                                  liveGridEditMatches.map(m => (
                                    <span key={m.id} className="inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[12px] font-semibold text-purple-700">
                                      {m.name}
                                    </span>
                                  ))
                                )}
                              </div>
                              <p className="text-[13px] text-gray-500">To change these, tap ✎ Edit at the top.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="min-w-0">
                                  <p className="mb-1 text-[13px] font-semibold text-gray-700">Aliases</p>
                                  <AliasPicker itemId={editItem.id} current={liveGridEditAliases} onChange={setLiveGridEditAliases} />
                                </div>
                                <div className="min-w-0">
                                  <p className="mb-1 text-[13px] font-semibold text-gray-700">
                                    {editItem.product_type === 'service' ? 'Goods used' : 'Services used'}
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
                                {ownerLevel && (
                                  <div className="min-w-0">
                                    <p className="mb-1 text-[13px] font-semibold text-gray-700">Merge</p>
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
                              {ownerLevel && (
                                <div className="flex justify-end">
                                  {!liveGridEditConfirmDelete ? (
                                    <button onClick={() => setLiveGridEditConfirmDelete(true)}
                                      className="rounded bg-gray-100 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                                      Delete item
                                    </button>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <p className="text-sm text-red-600">No sales/bills/counts?</p>
                                      <button onClick={deleteGridEditItem} disabled={liveGridEditDeleting}
                                        className="rounded bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-40">
                                        {liveGridEditDeleting ? 'Deleting…' : 'Confirm'}
                                      </button>
                                      <button onClick={() => { setLiveGridEditConfirmDelete(false); setLiveGridEditDeleteError('') }}
                                        className="rounded bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-600">
                                        Cancel
                                      </button>
                                      {liveGridEditDeleteError && <p className="w-full text-right text-sm font-medium text-red-600">{liveGridEditDeleteError}</p>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <ItemBarcodes itemId={editItem.id} canUnlink={ownerLevel} />
                      </div>
                    )}

                    {/* ── Photo ── */}
                    {tab === 'photo' && ready && editItem && (
                      <ItemPicture itemId={editItem.id} name={editItem.name} group={(editItem as { cf_group?: string | null }).cf_group ?? null} />
                    )}

                    {/* Loading / missing for the tabs that need the item */}
                    {tab !== 'overview' && !ready && (
                      <p className="py-6 text-center text-sm text-gray-500">{liveGridEditLoading ? 'Loading…' : 'Item not found'}</p>
                    )}
                    <div className="h-[max(1.5rem,env(safe-area-inset-bottom))]" />
                  </div>
                </div>
              </div>
            )
          })()}</>)
}
