'use client'
import { ItemEditForm } from '../_components/ItemEditForm'
import CustomerBox from '../_components/CustomerBox'
import { formatPrice, itemAttentionFlags, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubSelectedItemPanel({ h }: { h: HubCtx }) {
  const { group, search, items, liveLabelByKey, setLiveLabelByKey, groups, liveTapError, setLiveTapError, liveSelectedItem, setLiveSelectedItem, liveDueWhenOpened, liveQty, setLiveQty, livePrice, setLivePrice, liveCID, setLiveCID, custNameRef, setRegisterFor, liveSaving, liveGmcTargetItem, setLiveGmcTargetItem, liveGmcCountSaving, liveTapStatus, setLiveTapStatus, liveEditingSelectedItem, setLiveEditingSelectedItem, liveEditForm, setLiveEditForm, liveEditCurrentCountInterval, liveEditCurrentSoh, liveEditLoading, liveEditSaving, liveEditError, setLiveEditError, showToast, liveCountQty, setLiveCountQty, liveCountSaving, liveCountError, setLiveCountError, liveCountStatus, liveGmcTargetStock, liveGmcOpenOverage, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveLowConfidenceAliasIds, livePrezohoNotesIds, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveNetGainByItemId, liveEmptyRowCountByItemId, recordTap, recordCountAndSale, submitCount, liveEditGroups, liveEditAllItemsList, startEditSelectedItem, saveEditSelectedItem, saveGmcTypeOnly, saveConversionTargetOnly } = h
  return (<>{liveSelectedItem && (() => {
              const due = liveCountStatus.get(liveSelectedItem.id)
              const flags = itemAttentionFlags(liveSelectedItem, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveNetGainByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveGmcTargetStock, liveGmcOpenOverage, liveLowConfidenceAliasIds, livePrezohoNotesIds)
              const expected = Number(liveSelectedItem.soh)
              const enteredCount = liveCountQty === '' ? null : Number(liveCountQty)
              const countShort = enteredCount !== null && !isNaN(enteredCount) && enteredCount < expected
              return (
              <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                <div className="w-full bg-white rounded-t-2xl shadow-xl max-h-[92dvh] overflow-y-auto">
                  <div className="px-4 py-4 border-b border-gray-200 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{liveSelectedItem.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        <span>Selling: ₵{formatPrice(liveSelectedItem.selling_price)}</span>
                        <span className="text-gray-400"> · </span>
                        <span>Cost (ACP): ₵{formatPrice(liveSelectedItem.acp_price ?? liveSelectedItem.cost_price)}</span>
                        <span className="text-gray-400"> · </span>
                        <span>Stock: {Math.ceil(Number(liveSelectedItem.soh))} pc</span>
                      </p>
                    </div>
                    {!liveEditingSelectedItem && (
                      <button
                        type="button"
                        onClick={startEditSelectedItem}
                        className="shrink-0 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {/* Editing this item's own fields -- opened via the Edit button
                      above. Replaces the sale/count body below rather than
                      stacking alongside it, so there's no ambiguity about which
                      form a tap on Save applies to. Cancel returns to the normal
                      sheet, it doesn't close it. */}
                  {liveEditingSelectedItem ? (
                    <div className="p-4">
                      {liveEditLoading ? (
                        <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
                      ) : (
                        <ItemEditForm
                          form={liveEditForm}
                          onChange={setLiveEditForm}
                          groups={liveEditGroups}
                          itemId={liveSelectedItem.id}
                          isService={liveSelectedItem.product_type === 'service'}
                          allItems={liveEditAllItemsList}
                          size="large"
                          currentCountInterval={liveEditCurrentCountInterval}
                          currentSoh={liveEditCurrentSoh}
                          acp={liveSelectedItem.acp_price}
                          onGmcTypeSave={saveGmcTypeOnly}
                          onConversionTargetSave={saveConversionTargetOnly}
                        />
                      )}
                      {liveEditError && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                          {liveEditError}
                        </div>
                      )}

                      {/* Quick tap while editing */}
                      {!liveEditLoading && liveSelectedItem && (
                        <div className="mt-4 rounded-xl border border-blue-200 overflow-hidden bg-blue-50">
                          <div className="px-3 py-1.5 text-xs font-extrabold text-white bg-blue-600">
                            QUICK TAP
                          </div>
                          {liveTapStatus.length > 0 && (
                            <div className="p-2 border-b border-blue-200 bg-white">
                              <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[9px] font-mono text-blue-900 max-h-20 overflow-y-auto">
                                {liveTapStatus.map((msg, i) => (
                                  <div key={i}>{msg}</div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="p-3 space-y-2">
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">Quantity</label>
                              <input
                                type="number"
                                inputMode="decimal"
                                min="1"
                                step="1"
                                value={liveQty}
                                onChange={e => setLiveQty(e.target.value)}
                                placeholder="Enter quantity"
                                className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                                disabled={liveSaving}
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">Price (optional)</label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₵</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  step="0.01"
                                  value={livePrice}
                                  onChange={e => setLivePrice(e.target.value)}
                                  placeholder={formatPrice(liveSelectedItem?.selling_price || 0)}
                                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                                  disabled={liveSaving}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">Customer ID (optional)</label>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-600 bg-gray-100 rounded-lg px-3 py-2">GM</span>
                                <CustomerBox
                                  value={liveCID}
                                  onChange={setLiveCID}
                                  onName={n => { custNameRef.current = n }}
                                  label={liveLabelByKey.main ?? ''}
                                  onLabel={l => setLiveLabelByKey(prev => ({ ...prev, main: l ?? '' }))}
                                  onRegister={(phone, done) => setRegisterFor({ phone, done })}
                                  placeholder="Who? GM / phone / name / label (required)"
                                  className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                                  disabled={liveSaving}
                                />
                              </div>
                            </div>
                            {liveTapError && (
                              <div className="bg-red-50 border border-red-200 rounded-lg px-2 py-1 text-xs text-red-600 font-medium">
                                {liveTapError}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  // recordTap handles prepending GM prefix from liveCID
                                  await recordTap()
                                  setLiveEditingSelectedItem(false)
                                } catch (e) {
                                  const errMsg = e instanceof Error ? e.message : String(e)
                                  console.error('[QUICK TAP] Error:', errMsg)
                                  setLiveTapError(`Tap failed: ${errMsg}`)
                                  setLiveTapStatus(prev => [...prev, `ERROR: ${errMsg}`])
                                  showToast(`Tap failed: ${errMsg}`, 'error')
                                }
                              }}
                              disabled={liveQty === '' || liveSaving}
                              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {liveSaving ? 'Recording…' : 'Tap Sale'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Manual count -- lets this item be counted from the edit
                          view even when it isn't currently due (the due block
                          below only shows up for items the count queues have
                          already flagged). Its own submit, going through the
                          same submitCount() the due block uses, so it hits the
                          same pack-pairing/loss-reason prompts. */}
                      {!liveEditLoading && liveSelectedItem.product_type !== 'service' && (
                        <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden">
                          <div className="px-3 py-1.5 text-xs font-extrabold text-white bg-gray-700">
                            MANUAL COUNT
                          </div>
                          <div className="p-3 space-y-2 bg-gray-50">
                            <p className="text-xs text-gray-600">System expects <b>{expected}</b> on the shelf.</p>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="any"
                                value={liveCountQty}
                                onChange={e => setLiveCountQty(e.target.value)}
                                placeholder="Counted quantity"
                                className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400"
                                disabled={liveCountSaving}
                              />
                              <button
                                type="button"
                                onClick={() => setLiveCountQty(String(expected))}
                                disabled={liveCountSaving}
                                className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                              >
                                ={expected}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  alert(`Button clicked. enteredCount=${enteredCount}, liveCountQty='${liveCountQty}'`)
                                  enteredCount !== null && submitCount(liveSelectedItem, enteredCount)
                                }}
                                disabled={liveCountQty === '' || liveCountSaving}
                                className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 bg-purple-600 hover:bg-purple-700`}
                              >
                                {liveCountSaving ? '…' : countShort ? 'Save as loss' : 'Save Count'}
                              </button>
                            </div>
                            {enteredCount !== null && !isNaN(enteredCount) && (
                              <p className={`text-xs font-semibold ${countShort ? 'text-red-600' : 'text-emerald-600'}`}>
                                {countShort
                                  ? `${(expected - enteredCount).toFixed(2).replace(/\.00$/, '')} short of expected — a reason will be requested`
                                  : 'On target'}
                              </p>
                            )}
                            {liveCountError && <p className="text-xs font-semibold text-red-600">{liveCountError}</p>}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setLiveEditingSelectedItem(false)
                            setLiveEditError('')
                            setLiveCountQty('')
                            setLiveCountError('')
                          }}
                          disabled={liveEditSaving}
                          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveEditSelectedItem}
                          disabled={liveEditSaving || liveEditLoading || !liveEditForm.item_name.trim()}
                          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveEditSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                  <>
                  {/* Same negative-stock/missing-price/missing-cost/missing-group
                      banners the grid card shows (see itemAttentionFlags) -- shown
                      here too since the modal is reached directly from a search
                      pick as well as from a grid card, and a searched-and-picked
                      item skips the grid card entirely. Every flag gets its own
                      line (not just the worst one) so a genuinely broken item
                      doesn't read as having only one problem. */}
                  {flags.map((f, i) => (
                    <div key={i} className={`mx-4 ${i === 0 ? 'mt-4' : 'mt-1.5'} px-3 py-1.5 rounded-lg text-xs font-extrabold text-white ${f.bg}`}>
                      {f.label}
                    </div>
                  ))}

                  {/* This item is due for a count -- surfaced right inside the
                      sale sheet instead of requiring a separate mode-switch and
                      a separate tap. Still its own field and its own submit,
                      going to the count endpoint independently of the sale
                      below, so entering one never gets mistaken for the other. */}
                  {due && (
                    <div className={`mx-4 mt-4 rounded-xl border overflow-hidden ${due.level === 'overdue' ? 'border-red-300' : 'border-amber-300'}`}>
                      <div className={`px-3 py-1.5 text-xs font-extrabold text-white flex items-center justify-between gap-2 whitespace-nowrap ${due.level === 'overdue' ? 'bg-red-600' : 'bg-amber-500'}`}>
                        <span className="truncate">⚠ COUNT NOW · {due.label} {due.level === 'overdue' ? 'OVERDUE' : ''}</span>
                      </div>
                      <div className={`p-3 space-y-2 ${due.level === 'overdue' ? 'bg-red-50' : 'bg-amber-50'}`}>
                        <p className="text-xs text-gray-600">System expects <b>{expected}</b> on the shelf.</p>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={liveCountQty}
                            onChange={e => setLiveCountQty(e.target.value)}
                            placeholder="Counted quantity"
                            className="flex-1 text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-amber-400"
                            disabled={liveCountSaving}
                          />
                          <button
                            type="button"
                            onClick={() => setLiveCountQty(String(expected))}
                            disabled={liveCountSaving}
                            className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50"
                          >
                            ={expected}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              alert(`Button clicked. enteredCount=${enteredCount}, liveCountQty='${liveCountQty}'`)
                              if (enteredCount !== null && !isNaN(enteredCount)) {
                                submitCount(liveSelectedItem, enteredCount)
                              }
                            }}
                            disabled={liveCountQty === '' || liveCountSaving}
                            className={`shrink-0 px-3 py-2 text-white text-sm font-semibold rounded-lg transition disabled:opacity-50 bg-purple-600 hover:bg-purple-700`}
                          >
                            {liveCountSaving ? '…' : countShort ? 'Save as loss' : 'Save Count'}
                          </button>
                        </div>
                        {enteredCount !== null && !isNaN(enteredCount) && (
                          <p className={`text-xs font-semibold ${countShort ? 'text-red-600' : 'text-emerald-600'}`}>
                            {countShort
                              ? `${(expected - enteredCount).toFixed(2).replace(/\.00$/, '')} short of expected — a reason will be requested`
                              : 'On target'}
                          </p>
                        )}
                        {liveCountError && <p className="text-xs font-semibold text-red-600">{liveCountError}</p>}
                      </div>
                    </div>
                  )}
                  {!due && liveDueWhenOpened && (
                    <div className="mx-4 mt-4 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span className="text-sm font-semibold text-emerald-700">Stock counted for today.</span>
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Quantity <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step="1"
                        value={liveQty}
                        onChange={e => setLiveQty(e.target.value)}
                        placeholder="Enter quantity"
                        className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                        disabled={liveSaving}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-2">
                        Price (optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₵</span>
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={livePrice}
                          onChange={e => setLivePrice(e.target.value)}
                          placeholder={formatPrice(liveSelectedItem.selling_price)}
                          className="w-full text-lg font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg pl-7 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                          disabled={liveSaving}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Defaults to ₵{formatPrice(liveSelectedItem.selling_price)}
                      </p>
                    </div>

                    {liveGmcTargetItem && (
                      <div className="bg-blue-50 border border-blue-300 rounded-lg px-3 py-3">
                        <p className="text-xs font-semibold text-blue-900 mb-1">Material Tracking: {liveGmcTargetItem.name}</p>
                        <p className="text-sm font-bold text-blue-700 mb-2">
                          Current: <span className="text-blue-900">{liveGmcTargetItem.soh.toFixed(2)}</span> units
                        </p>
                        {liveQty && (
                          <p className="text-sm text-blue-700">
                            Remaining after sale: <span className="font-bold text-blue-900">{Math.max(0, liveGmcTargetItem.soh - Number(liveQty)).toFixed(2)}</span> units
                          </p>
                        )}
                      </div>
                    )}

                    {liveTapError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600 font-medium">
                        {liveTapError}
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setLiveSelectedItem(null)
                            setLiveQty('')
                            setLivePrice('')
                            setLiveTapError('')
                            setLiveCountQty('')
                            setLiveCountError('')
                            setLiveEditingSelectedItem(false)
                            setLiveEditError('')
                            setLiveGmcTargetItem(null)
                          }}
                          disabled={liveSaving || liveGmcCountSaving}
                          className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const clickedMsg = `[MAIN TAP] Button clicked - item: ${liveSelectedItem?.name}, qty: ${liveQty}`
                            console.log(clickedMsg)
                            alert(clickedMsg)
                            setLiveTapStatus(['CLICKED - Starting recordTap...'])
                            try {
                              await recordTap()
                            } catch (e) {
                              const errMsg = e instanceof Error ? e.message : String(e)
                              console.error('[MAIN TAP] Error:', errMsg)
                              alert(`MAIN TAP ERROR: ${errMsg}`)
                              setLiveTapError(`Tap failed: ${errMsg}`)
                              setLiveTapStatus(prev => [...prev, `ERROR: ${errMsg}`])
                              showToast(`Tap failed: ${errMsg}`, 'error')
                            }
                          }}
                          disabled={!liveQty || liveSaving || liveGmcCountSaving}
                          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveSaving ? 'Saving…' : 'Tap'}
                        </button>
                      </div>
                      {liveGmcTargetItem && (
                        <button
                          type="button"
                          onClick={() => recordCountAndSale()}
                          disabled={!liveQty || liveSaving || liveGmcCountSaving}
                          className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                        >
                          {liveGmcCountSaving ? 'Saving…' : 'Count & Save'}
                        </button>
                      )}
                    </div>
                  </div>
                  </>
                  )}
                </div>
              </div>
              )
            })()}</>)
}
