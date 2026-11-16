'use client'
import { Fragment, useEffect, useRef, useState } from 'react'
import { thumbUrlOf } from '@/lib/itemThumb'
import { fmtDate } from '@/lib/fmtDate'
import { formatACP } from '@/lib/fmtNumber'
import CustomerBox from '../_components/CustomerBox'
import { formatPrice, shortCountInterval, formatLoss, itemAttentionFlags, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'
import { useFeatures } from '@/lib/useFeatures'

// The photo strip at the top of a tile in Pictures view: the small copy of the item's photo (falls back to the full photo).
// The whole photo is shown (not cropped to the strip) so the item is easy to recognise; an item with no photo gets a slim,
// tappable strip that opens its sheet on the Photo tab.
function TilePhoto({ url, onOpen }: { url: string | null | undefined; onOpen: () => void }) {
  if (!url) return (
    <button type="button" onClick={e => { e.stopPropagation(); onOpen() }}
      className="flex h-20 w-full flex-col items-center justify-center gap-1 bg-gray-50 text-[12px] font-semibold text-blue-600"><span className="text-xl">📷</span>+ Add photo</button>
  )
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onOpen() }} aria-label="Open this item's photo" className="flex h-20 w-full items-center justify-center bg-white">
      <img src={thumbUrlOf(url)} alt="" loading="lazy" onError={e => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = '1'; el.src = url } }}
        className="max-h-full max-w-full object-contain" />
    </button>
  )
}

export default function HubCatalogueGrid({ h }: { h: HubCtx }) {
  // Compact (the default: fastest to scan) or Pictures: each staff member's choice on this device.
  const [pics, setPics] = useState(false)
  useEffect(() => { try { setPics(localStorage.getItem('livePictures') === '1') } catch { /* ignore */ } }, [])
  const setView = (on: boolean) => { setPics(on); try { localStorage.setItem('livePictures', on ? '1' : '0') } catch { /* ignore */ } }
  // Long-press (half a second, finger not moving) starts a selection; once something is selected, a tap on a tile selects or unselects it.
  const { liveSelectedIds, toggleLiveSelect, liveSaleType: saleTypeForSelect, setLiveGridEditStartTab } = h
  const selecting = liveSelectedIds.length > 0
  const pressTimer = useRef<number | null>(null)
  const pressFrom = useRef({ x: 0, y: 0 })
  const suppressClick = useRef(false)
  const cancelPress = () => { if (pressTimer.current !== null) { window.clearTimeout(pressTimer.current); pressTimer.current = null } }
  const startPress = (e: React.PointerEvent, id: number) => {
    if (selecting || saleTypeForSelect === 'GMC' || (e.target as HTMLElement).closest('input,select,textarea,[aria-label^="Record sale"]')) return   // the name (a link to the item) can start a selection; the boxes and the sale tick cannot
    pressFrom.current = { x: e.clientX, y: e.clientY }
    cancelPress()
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null
      suppressClick.current = true
      window.setTimeout(() => { suppressClick.current = false }, 800)   // the lift that ends the press must not count as a tap
      toggleLiveSelect(id)
      try { navigator.vibrate?.(30) } catch { /* ignore */ }
    }, 500)
  }
  const movePress = (e: React.PointerEvent) => { if (pressTimer.current !== null && Math.hypot(e.clientX - pressFrom.current.x, e.clientY - pressFrom.current.y) > 10) cancelPress() }
  const features = useFeatures()   // Settings > Switches: the Who? box
  const { group, violation, liveSaleViolationFilter, items, liveInlineQtyByItemId, setLiveInlineQtyByItemId, liveInlinePriceByItemId, setLiveInlinePriceByItemId, liveInlineCIDByItemId, setLiveInlineCIDByItemId, liveLabelByKey, setLiveLabelByKey, justTappedItemIds, session, custNameRef, miOn, setRegisterFor, liveSaving, renderClickableItemName, liveCountStatus, liveLastCountDateByItemId, liveGmcTargetStock, liveGmcOpenOverage, liveLossByItemId, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveLowConfidenceAliasIds, livePrezohoNotesIds, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveNetGainByItemId, liveEmptyRowCountByItemId, liveSalesCounts, liveSortedCatalogueItems, liveDueCatalogueCount, recordInlineTap, openEditGridItem } = h
  // Only the tiles near the screen are drawn: the first 48, and 48 more each time the end of the list comes into view (600 tiles at once is about 10,000 page elements).
  // A new search or filter starts again from the top.
  const PAGE = 48
  const [shown, setShown] = useState(PAGE)
  const moreRef = useRef<HTMLDivElement | null>(null)
  const total = liveSortedCatalogueItems.length
  useEffect(() => { setShown(PAGE) }, [h.search, liveSaleViolationFilter, h.liveProductTypeFilter, h.liveGroupFilter, pics])
  useEffect(() => {
    const el = moreRef.current
    if (!el || shown >= total) return
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) setShown(n => n + PAGE) }, { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown, total])
  return (<>{liveSortedCatalogueItems.slice(0, shown).map((item, idx) => {
                    const count = liveSalesCounts.get(item.id) ?? 0
                    const due = liveCountStatus.get(item.id)
                    const overdue = due?.level === 'overdue'
                    // Being due for a count doesn't rule out having some
                    // other data-integrity problem too (negative stock, a
                    // gain, a duplicate...) -- surface those the same way
                    // regardless of whether this item is also due, instead
                    // of letting the COUNT NOW banner hide them.
                    const flags = itemAttentionFlags(item, liveDuplicateItemIds, liveUnlinkedNamedIds, liveServiceViolationIdSet, liveNetGainByItemId, liveEmptyRowCountByItemId, liveSoldBelowCostDatesByItemId, liveVcpJumpDatesByItemId, liveGmcTargetStock, liveGmcOpenOverage, liveLowConfidenceAliasIds, livePrezohoNotesIds)
                    // Darker, thicker borders than the *-100 shades used
                    // before -- those were nearly invisible against the
                    // white/near-white card backgrounds, so items ran
                    // together with no visible separation between them.
                    // White cards: the status is a coloured left edge, so red only marks an overdue count (the header strip also says so).
                    const cardBgCls = due
                      ? (overdue ? 'bg-white border-gray-300 border-l-4 border-l-red-500 hover:bg-gray-50' : 'bg-white border-gray-300 border-l-4 border-l-amber-400 hover:bg-gray-50')
                      : (flags.length > 0 ? 'bg-white border-gray-300 border-l-4 border-l-orange-400 hover:bg-gray-50' : 'bg-white border-gray-300 hover:bg-gray-50')
                    const selected = liveSelectedIds.includes(item.id)
                    return (
                      <Fragment key={item.id}>
                        {idx === 0 && (
                          <div className="col-span-2 sm:col-span-3 md:col-span-6 flex items-center justify-end gap-1 border-b border-gray-200 bg-gray-50 px-2 py-0.5">
                            <span className="mr-auto text-[11px] text-gray-500">Hold an item to select several</span>
                            <span className="mr-1 text-[12px] font-semibold text-gray-500">View</span>
                            <button type="button" onClick={() => setView(false)} className={`rounded px-2 py-0.5 text-[12px] font-bold ${!pics ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>Compact</button>
                            <button type="button" onClick={() => setView(true)} className={`rounded px-2 py-0.5 text-[12px] font-bold ${pics ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 border border-gray-300'}`}>Pictures</button>
                          </div>
                        )}
                        {idx === 0 && liveDueCatalogueCount > 0 && (
                          <div className="col-span-2 sm:col-span-3 md:col-span-6 px-2 py-1 bg-gray-800 text-[12px] font-bold text-white uppercase tracking-wide">
                            {liveDueCatalogueCount} item{liveDueCatalogueCount !== 1 ? 's' : ''} need{liveDueCatalogueCount === 1 ? 's' : ''} counting
                          </div>
                        )}
                        <div
                          // The default Live view now taps straight into the
                          // card's own Qty/Price boxes below -- opening the
                          // edit sheet on any tap would fight that, so this
                          // whole-card handler only applies to the other
                          // (diagnostic/violation) filters, same as before.
                          // Selling is no longer blocked on items due for a
                          // count, so unlike the first version of this
                          // change, due items get the same inline boxes as
                          // everything else here -- counting them still
                          // works via the Count Due filter/tab, just not
                          // from a tap on this default view's card any more.
                          onClick={liveSaleViolationFilter === 'noViolations' ? undefined : () => openEditGridItem(item.id)}
                          onPointerDown={e => startPress(e, item.id)}
                          onPointerMove={movePress}
                          onPointerUp={cancelPress}
                          onPointerCancel={cancelPress}
                          onPointerLeave={cancelPress}
                          onContextMenu={e => { if (!(e.target as HTMLElement).closest('input,textarea')) e.preventDefault() }}
                          onClickCapture={e => {
                            if (suppressClick.current) { suppressClick.current = false; e.preventDefault(); e.stopPropagation(); return }
                            if (selecting && !(e.target as HTMLElement).closest('input,select,textarea')) { e.preventDefault(); e.stopPropagation(); toggleLiveSelect(item.id) }
                          }}
                          className={`relative flex flex-col border-r-2 border-b-2 group select-none [content-visibility:auto] [contain-intrinsic-size:auto_160px] [-webkit-touch-callout:none] [&_input]:select-text ${liveSaleViolationFilter === 'noViolations' ? '' : 'cursor-pointer'} ${cardBgCls} ${selected ? 'ring-2 ring-inset ring-green-600' : ''} transition`}
                        >
                          {selected && <span className="pointer-events-none absolute inset-0 z-[5] bg-green-500/15" role="img" aria-label="Selected" />}
                          {liveSaleViolationFilter !== 'noViolations' && liveSaleViolationFilter === 'countDue' && due && (
                            <div className={`px-2 py-1 text-[12px] font-extrabold text-white tracking-wide flex items-center justify-between gap-2 whitespace-nowrap ${overdue ? 'bg-red-600' : 'bg-amber-500'}`}>
                              <span className="truncate">{due.label} {overdue ? 'OVERDUE' : 'DUE'}</span>
                            </div>
                          )}
                          {/* Net Loss has no badge at all (see itemAttentionFlags --
                              it's not a violation, just a view), so it falls
                              through to the final `else filteredFlags = []`
                              below same as every other unhandled filter --
                              no per-card banner shows in that view, just the
                              plain Loss/Gain line further down the card. */}
                          {liveSaleViolationFilter !== 'noViolations' && liveSaleViolationFilter !== 'countDue' && (() => {
                            let filteredFlags: typeof flags = []
                            if (liveSaleViolationFilter === 'duplicates') filteredFlags = flags.filter(f => f.label.includes('DUPLICATE'))
                            else if (liveSaleViolationFilter === 'unlinked') filteredFlags = flags.filter(f => f.label.includes('UNLINKED'))
                            else if (liveSaleViolationFilter === 'service') filteredFlags = flags.filter(f => f.label.includes('SERVICE'))
                            else if (liveSaleViolationFilter === 'soldBelowCost') filteredFlags = flags.filter(f => f.label.includes('SOLD BELOW COST'))
                            else if (liveSaleViolationFilter === 'vcpJump') filteredFlags = flags.filter(f => f.label.includes('VCP JUMP'))
                            else if (liveSaleViolationFilter === 'emptyRow') filteredFlags = flags.filter(f => f.label.includes('EMPTY DATA'))
                            else if (liveSaleViolationFilter === 'netGain') filteredFlags = flags.filter(f => f.label.includes('NET GAIN'))
                            else if (liveSaleViolationFilter === 'negSoh') filteredFlags = flags.filter(f => f.label.includes('NEGATIVE STOCK'))
                            else if (liveSaleViolationFilter === 'acpGteSp') filteredFlags = flags.filter(f => f.label.includes('ACP > SP'))
                            else if (liveSaleViolationFilter === 'noSp') filteredFlags = flags.filter(f => f.label.includes('MISSING SELLING PRICE'))
                            else if (liveSaleViolationFilter === 'noCp') filteredFlags = flags.filter(f => f.label.includes('MISSING COST PRICE'))
                            else if (liveSaleViolationFilter === 'noGroup') filteredFlags = flags.filter(f => f.label.includes('MISSING GROUP'))
                            else if (liveSaleViolationFilter === 'needsReview') filteredFlags = flags.filter(f => f.label.includes('NEEDS REVIEW'))
                            else if (liveSaleViolationFilter === 'lowConfidenceAlias') filteredFlags = flags.filter(f => f.label.includes('ALIAS NEEDS CHECK'))
                            else if (liveSaleViolationFilter === 'prezohoNotes') filteredFlags = flags.filter(f => f.label.includes('LEDGER NOTES'))
                            return filteredFlags.map((f, i) => {
                              // Strip the violation's own name down to just
                              // its number/detail (if it has one) -- picking
                              // this specific filter already says what the
                              // problem is, repeating the name on every card
                              // is redundant. Pure yes/no flags (no number
                              // attached) end up blank and render nothing at
                              // all -- the card's own tinted background
                              // already shows something's flagged.
                              let displayLabel = f.label
                              if (f.label.includes('DUPLICATE')) displayLabel = ''
                              else if (f.label.includes('UNLINKED')) displayLabel = ''
                              else if (f.label.includes('SERVICE')) displayLabel = ''
                              else if (f.label.includes('NEGATIVE STOCK')) displayLabel = ''
                              else if (f.label.includes('NET GAIN:')) displayLabel = f.label.replace('🔺 NET GAIN: ', '')
                              else if (f.label.includes('SOLD BELOW COST')) displayLabel = f.label.replace('⚠ SOLD BELOW COST (history): ', '')
                              else if (f.label.includes('VCP JUMP')) displayLabel = f.label.replace('⚠ VCP JUMP (history): ', '')
                              else if (f.label.includes('ACP > SP')) displayLabel = ''
                              else if (f.label.includes('MISSING SELLING PRICE')) displayLabel = ''
                              else if (f.label.includes('MISSING COST PRICE')) displayLabel = ''
                              else if (f.label.includes('MISSING GROUP')) displayLabel = ''
                              else if (f.label.includes('EMPTY DATA')) displayLabel = f.label.replace('⚠ EMPTY DATA: ', '')
                              return displayLabel ? (
                                <div key={i} className={`px-2 py-0.5 text-[12px] font-extrabold text-white tracking-wide truncate ${f.bg}`}>
                                  {displayLabel}
                                </div>
                              ) : null
                            })
                          })()}
                          {pics && <TilePhoto url={(item as { image_url?: string | null }).image_url} onOpen={() => { setLiveGridEditStartTab('photo'); openEditGridItem(item.id) }} />}
                          <div className="px-1 py-0.5 flex flex-col">
                            {liveSaleViolationFilter === 'countDue' ? (
                              <>
                                <div className={`text-[12px] font-semibold leading-tight truncate text-left pr-5`}>
                                  {renderClickableItemName(item.name, `text-[12px] leading-tight truncate text-left text-blue-600`)}
                                </div>
                                <p className="text-[12px] text-gray-600 leading-tight mt-0.5">
                                  <span>Last ctd: </span>
                                  <span className="font-semibold text-gray-900">
                                    {liveLastCountDateByItemId.get(item.id) ? fmtDate(liveLastCountDateByItemId.get(item.id)!) : 'Never'}
                                  </span>
                                  {item.count_interval && (
                                    <>
                                      <span className="text-gray-400"> · </span>
                                      <span className="text-gray-500">Interval {shortCountInterval(item.count_interval)}</span>
                                    </>
                                  )}
                                </p>
                                <p className="text-[12px] text-gray-600 leading-tight">
                                  <span>SOH: </span>
                                  <span className="font-semibold text-gray-900">{Math.ceil(Number(item.soh))} pc</span>
                                </p>
                              </>
                            ) : (
                              <>
                                <div className={`text-[12px] font-semibold leading-tight truncate text-left pr-5 ${item.product_type !== 'service' && Number(item.soh) === 0 ? 'line-through text-gray-400' : ''}`}>
                                  {renderClickableItemName(item.name, `text-[12px] leading-tight truncate text-left ${item.product_type !== 'service' && Number(item.soh) === 0 ? 'line-through text-gray-400' : 'text-blue-600'}`)}
                                </div>
                                {liveSaleViolationFilter === 'noViolations' ? (
                                  <>
                                    {item.product_type !== 'service' && (
                                      <p className="text-[12px] text-gray-600 leading-tight">
                                        <span className="text-green-600 font-semibold">ACP ₵{formatACP(item.acp_price ?? item.cost_price)}</span>
                                        <span className="text-gray-400"> · </span>
                                        <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                                      </p>
                                    )}
                                    {/* A service has no stock of its own -- what staff
                                        actually need at a glance is the material it draws
                                        down (e.g. Passport Picture -> 4x6 singles), read
                                        from the same liveGmcTargetStock map the GMC-target
                                        badge/gate logic already keeps current. */}
                                    {item.product_type === 'service' && item.converts_to_item_id != null && (
                                      <p className="text-[12px] text-gray-600 leading-tight">
                                        <span className="text-slate-600 font-semibold">
                                          {item.converts_to_name ?? 'material'} left = {Math.ceil(liveGmcTargetStock.get(item.converts_to_item_id) ?? 0)}
                                        </span>
                                      </p>
                                    )}
                                    {/* Tap straight into the card: no plain-text price any
                                        more, the Price box below is the only place it shows
                                        up (pre-filled, so most sales never need to touch it).
                                        Typing a Qty reveals the confirm checkmark; Enter in
                                        either box also submits. A Goods item sitting at 0
                                        stock has nothing to sell, so the boxes are hidden --
                                        this reads item.soh live, so they come back on their
                                        own the moment a bill brings stock back in, no extra
                                        wiring needed. Services never carry stock, so they
                                        always keep the boxes regardless of soh. */}
                                    {(item.product_type === 'service' || Number(item.soh) > 0) && (
                                      <div className="flex items-center gap-1 mt-1">
                                        <label className="flex-[0.8] min-w-0 rounded-md border border-gray-300 bg-white px-1 py-0.5 flex items-center focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200">
                                          <input
                                            type="number" inputMode="decimal" placeholder="Qty"
                                            disabled={!session}
                                            value={liveInlineQtyByItemId[item.id] ?? '1'}
                                            onChange={e => setLiveInlineQtyByItemId(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') recordInlineTap(item) }}
                                            onFocus={e => { const el = e.currentTarget; setTimeout(() => el.select(), 0) }}
                                            onClick={e => e.stopPropagation()}
                                            className="w-full min-w-0 text-[12px] font-semibold text-gray-900 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                          />
                                        </label>
                                        <label className="flex-[1.8] min-w-0 rounded-md border border-gray-300 bg-white px-1 py-0.5 flex items-center gap-0.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200">
                                          <span className="text-[12px] text-gray-400">₵</span>
                                          <input
                                            type="number" inputMode="decimal"
                                            disabled={!session}
                                            value={liveInlinePriceByItemId[item.id] ?? formatPrice(item.selling_price)}
                                            onChange={e => setLiveInlinePriceByItemId(prev => ({ ...prev, [item.id]: e.target.value }))}
                                            onKeyDown={e => { if (e.key === 'Enter') recordInlineTap(item) }}
                                            onFocus={e => { const el = e.currentTarget; setTimeout(() => el.select(), 0) }}
                                            onClick={e => e.stopPropagation()}
                                            className="w-full min-w-0 text-[12px] font-semibold text-gray-900 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                          />
                                        </label>
                                        {!miOn && features.live_who && (<label className="flex-[1.2] min-w-0 rounded-md border border-gray-300 bg-white px-1 py-0.5 flex items-center gap-0.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-200">
                                          <CustomerBox
                                            disabled={!session}
                                            value={liveInlineCIDByItemId[item.id] ?? ''}
                                            onChange={v => setLiveInlineCIDByItemId(prev => ({ ...prev, [item.id]: v }))}
                                            onName={n => { custNameRef.current = n }}
                                            label={liveLabelByKey[String(item.id)] ?? ''}
                                            onLabel={l => setLiveLabelByKey(prev => ({ ...prev, [String(item.id)]: l ?? '' }))}
                                            onRegister={(phone, done) => setRegisterFor({ phone, done })}
                                            onEnter={() => recordInlineTap(item)}
                                            placeholder="Who?"
                                            className="w-full min-w-0 text-[12px] font-semibold text-gray-900 outline-none bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                                          />
                                        </label>)}
                                        <button
                                          type="button"
                                          disabled={liveSaving || !session}
                                          onClick={e => { e.stopPropagation(); recordInlineTap(item) }}
                                          aria-label={`Record sale for ${item.name}`}
                                          className={`shrink-0 w-7 h-7 rounded-full text-white text-[13px] font-bold flex items-center justify-center disabled:opacity-50 transition-colors ${
                                            justTappedItemIds.has(item.id) ? 'bg-green-900 ring-2 ring-green-300' : 'bg-green-600 hover:bg-green-700'
                                          }`}
                                        >
                                          ✓
                                        </button>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-[12px] text-gray-600 leading-tight">
                                    <span className="text-blue-600 font-semibold">₵{formatPrice(item.selling_price)}</span>
                                    <span className="text-gray-400"> · </span>
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className="text-green-600 font-semibold">ACP ₵{formatACP(item.acp_price ?? item.cost_price)}</span>
                                        <span className="text-gray-400"> · </span>
                                      </>
                                    )}
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className="text-slate-600 font-semibold">{Math.ceil(Number(item.soh))} pc</span>
                                        {item.count_interval && (
                                          <>
                                            <span className="text-gray-400"> · </span>
                                            <span className="text-gray-500">{shortCountInterval(item.count_interval)}</span>
                                          </>
                                        )}
                                        <span className="text-gray-400"> · </span>
                                      </>
                                    )}
                                    {item.product_type !== 'service' && (
                                      <>
                                        <span className={formatLoss(liveLossByItemId.get(item.id)).cls}>{formatLoss(liveLossByItemId.get(item.id)).text}</span>
                                      </>
                                    )}
                                    {item.product_type === 'service' && item.converts_to_item_id != null && (
                                      <>
                                        <span className="text-slate-600 font-semibold">
                                          {item.converts_to_name ?? 'material'} left = {Math.ceil(liveGmcTargetStock.get(item.converts_to_item_id) ?? 0)}
                                        </span>
                                        <span className="text-gray-400"> · </span>
                                      </>
                                    )}
                                    {item.gmc_type && (
                                      <>
                                        <span className="text-gray-400"> · </span>
                                        <span className="inline-block rounded bg-purple-100 px-1 py-0.5 text-[12px] font-bold text-purple-700">
                                          {item.gmc_type === 'gmc' ? 'GMC' : item.gmc_type === 'service_no_gmc' ? 'SVC only' : item.gmc_type === 'pack_to_gmc' ? 'PKG→GMC' : 'SVC/GMC'}
                                          {item.converts_to_name && ` → ${item.converts_to_name}`}
                                        </span>
                                      </>
                                    )}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                          {count > 0 && (
                            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-3 h-3 px-0.5 rounded-full bg-blue-600 text-white text-[12px] font-bold">
                              {count}
                            </span>
                          )}
                        </div>
                        {liveDueCatalogueCount > 0 && idx === liveDueCatalogueCount - 1 && liveDueCatalogueCount < liveSortedCatalogueItems.length && (
                          <div className="col-span-3 md:col-span-6 border-b border-gray-200" />
                        )}
                      </Fragment>
                    )
                  })}{shown < total && <div ref={moreRef} aria-hidden="true" className="col-span-2 sm:col-span-3 md:col-span-6 h-10" />}</>)
}
