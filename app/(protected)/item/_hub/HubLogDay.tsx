'use client'
import { Fragment } from 'react'
import { fmtTime } from '@/lib/fmtDate'
import { formatGapMins } from '@/lib/fmtGap'
import DayCashCell from '../_components/DayCashCell'
import LogDayPhotos from '../_components/LogDayPhotos'
import { formatPrice, staffInitials, type Item, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubLogDay({ h }: { h: HubCtx }) {
  const { group, items, shop, openEmbed, isDesktop, liveAllItems, setLiveTaps, liveDayBounds, setTapCustomerSheet, rcptSelect, rcptSel, setRcptSel, setLiveEditingTapId, setLiveEditingTapTime, setLiveEditingFullTapId, setLiveEditingCurrentDate, renderClickableItemName, liveCostPriceByItemId, setLogRecs, logBarsOnly, jobMoneyOn, logDays, undoTap, openEditGridItem, renderModeToggleRow } = h
  return (<>{logDays.map(([date, logDay]) => {
                      const dateTaps = logDay.taps
                      // Day total and profit: tapped sales plus the day's record lines (history / typed-in lines).
                      const recTotal = logDay.lines.reduce((s2, l) => s2 + Number(l.item_total ?? 0), 0)
                      const recProfit = logDay.lines.reduce((s2, l) => {
                        const cp = l.item_id ? liveCostPriceByItemId.get(l.item_id) : undefined
                        return s2 + (cp !== undefined && l.quantity != null ? Number(l.item_total ?? 0) - cp * Number(l.quantity) : 0)
                      }, 0)
                      const dateTotal = (dateTaps || []).filter((t): t is Tap => t != null && !t.undone).reduce((s, t) => s + Number(t.price) * t.quantity, 0) + recTotal + jobMoneyOn(date)
                      const dateProfitTotal = (dateTaps || []).filter((t): t is Tap => t != null && !t.undone)
                        .reduce((s, t) => s + (Number(t.price) - (liveCostPriceByItemId.get(t.item_id) ?? 0)) * t.quantity, 0) + recProfit
                      const wicRec = logDay.receipts.find(r => !r.is_gmc) ?? null
                      return (
                        <Fragment key={date}>
                          {/* Date header */}
                          <tr id={`log-day-${date}`} className="bg-green-50 border-b border-green-200">
                            <td className="sticky left-0 top-[13px] z-10 bg-green-50 h-[13px] px-0.5 text-[12px] leading-none font-semibold text-green-700 whitespace-nowrap">
                              {rcptSelect && (() => {
                                const ok = (dateTaps || []).filter((t): t is Tap => t != null && !t.undone && !t.invoice_id)
                                return ok.length > 0 ? (
                                  <input type="checkbox" className="mr-0.5 h-3 w-3 align-middle accent-orange-500" title="Select this day's sales without a receipt"
                                    checked={ok.every(t => rcptSel.has(t.id))}
                                    onChange={e => setRcptSel(prev => { const n = new Set(prev); ok.forEach(t => e.target.checked ? n.add(t.id) : n.delete(t.id)); return n })} />
                                ) : null
                              })()}
                              {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5 leading-none flex gap-0.5 items-center justify-center">
                              <button
                                onClick={() => {
                                  setLiveEditingFullTapId(-1)
                                  setLiveEditingCurrentDate(date)
                                }}
                                title="Edit a log entry from this day"
                                className="text-green-600 hover:text-green-800 font-bold text-[12px] leading-none p-0 border-0 bg-transparent"
                              >
                                ✏️
                              </button>
                            </td>
                            <td className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5" />
                            <td className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5 text-right text-[12px] leading-none font-semibold text-green-700 whitespace-nowrap">
                              ₵{formatPrice(dateTotal)}
                            </td>
                            <td colSpan={8} className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5 text-left">
                              <span className="inline-flex items-center gap-1.5">
                              {(() => {
                                // Cash counted + WNW for the day's walk-in (WIC) receipt; GMC is internal use, no cash.
                                // The day receipt from the records is the source; today's sales fall back to their taps.
                                const wic = (dateTaps || []).filter((t): t is Tap => t != null && !t.is_gmc)
                                const rid = wicRec?.id ?? wic.find(t => t.receipt_id)?.receipt_id ?? null
                                const ccRaw = wicRec ? wicRec.cash_counted : wic.find(t => t.receipt_id === rid)?.receipt_cash_counted
                                const cc = ccRaw === null || ccRaw === undefined || ccRaw === '' ? null : Number(ccRaw)
                                const rtRaw = wicRec ? wicRec.total : wic.find(t => t.receipt_id === rid)?.receipt_total
                                const wicTotal = rtRaw !== null && rtRaw !== undefined && rtRaw !== '' ? Number(rtRaw)
                                  : wic.filter(t => !t.undone).reduce((s2, t) => s2 + Number(t.price) * t.quantity, 0)
                                return (
                                  <DayCashCell receiptId={rid} cashCounted={cc} salesTotal={wicTotal}
                                    onSaved={(v, total) => {
                                      setLiveTaps(prev => prev.map(t => t.receipt_id === rid ? { ...t, receipt_cash_counted: v, ...(total !== null ? { receipt_total: total } : {}) } : t))
                                      setLogRecs(p => p ? { ...p, receipts: p.receipts.map(r => r.id === rid ? { ...r, cash_counted: String(v), ...(total !== null ? { total: String(total) } : {}) } : r) } : p)
                                    }} />
                                )
                              })()}
                              {logDay.receipts.length > 0 && (
                                <LogDayPhotos receipts={logDay.receipts} />
                              )}
                              </span>
                            </td>
                            <td className="sticky top-[13px] z-10 bg-green-50 h-[13px] px-0.5 text-right text-[12px] leading-none font-semibold whitespace-nowrap">
                              <span className={dateProfitTotal < 0 ? 'text-red-600' : 'text-green-700'}>₵{formatPrice(dateProfitTotal)}</span>
                            </td>
                          </tr>

                          {/* Date's taps -- `group` + an explicit bg on the sticky
                              first cell (not bg-inherit) so scrolled-under columns
                              don't show through it, same fix as Item 360's table. */}
                          {!logBarsOnly && (dateTaps || []).filter((t): t is Tap => t != null).map((tap, i) => {
                            // Gap = time since the previous (chronologically
                            // earlier) tap -- dateTaps is newest-first, so that's
                            // index i+1. The day's oldest tap (i at the end of the
                            // array) has no earlier tap to diff against, so it
                            // uses the shop's opening time instead; the day's
                            // newest tap (i === 0) additionally gets a second
                            // reading against when the last staff signed out,
                            // shown instead of its since-previous-tap gap since
                            // that's the more useful number for the final sale of
                            // the day.
                            const filteredTaps = (dateTaps || []).filter((t): t is Tap => t != null)
                            const bounds = liveDayBounds[date]
                            const isOldest = i === filteredTaps.length - 1
                            const isNewest = i === 0
                            let gapMins: number | null = null
                            if (isNewest && bounds?.closeTime) {
                              gapMins = (new Date(bounds.closeTime).getTime() - new Date(tap.tapped_at).getTime()) / 60000
                            } else if (isOldest && bounds?.openTime) {
                              gapMins = (new Date(tap.tapped_at).getTime() - new Date(bounds.openTime).getTime()) / 60000
                            } else {
                              const prevTap = filteredTaps[i + 1]
                              if (prevTap) gapMins = (new Date(tap.tapped_at).getTime() - new Date(prevTap.tapped_at).getTime()) / 60000
                            }
                            const tapCostPrice = liveCostPriceByItemId.get(tap.item_id) ?? 0
                            const tapProfit = (Number(tap.price) - tapCostPrice) * tap.quantity
                            // Undone taps keep their own muted/struck-through
                            // look (not renderClickableItemName's blue/
                            // underline, which would make an undone sale
                            // look active) but should still open the item's
                            // modal on tap, same as any other row here.
                            const tapItem = liveAllItems.find(it => it.name.toLowerCase() === tap.item_name.toLowerCase())
                            return (
                            <tr
                              key={tap.id}
                              className={`group hover:bg-gray-50 transition ${
                                tap.undone ? 'bg-red-50 undone-row' : ''
                              }`}
                            >
                              <td className={`sticky left-0 z-[1] leading-tight px-0.5 py-0.5 ${isDesktop ? 'whitespace-nowrap' : 'max-w-[118px] min-w-[96px]'} align-top group-hover:bg-gray-50 ${tap.undone ? 'bg-red-50' : 'bg-white'}`}>
                                {/* WIC/GMC badge -- same blue/purple pair as the
                                    WIC/GMC toggle button above (renderModeToggleRow),
                                    so a mixed list of taps (this table doesn't filter
                                    by that toggle) still says which each one was. */}
                                {rcptSelect && (
                                  <input type="checkbox" className="mr-0.5 h-3 w-3 align-middle accent-orange-500"
                                    disabled={tap.undone || !!tap.invoice_id}
                                    title={tap.invoice_id ? `Already on receipt ${tap.invoice_number ?? ''}` : tap.undone ? 'Undone sale' : 'Add to receipt'}
                                    checked={rcptSel.has(tap.id)}
                                    onChange={e => setRcptSel(prev => { const n = new Set(prev); if (e.target.checked) n.add(tap.id); else n.delete(tap.id); return n })} />
                                )}
                                <span className={`inline-block rounded px-0.5 mr-0.5 text-[12px] font-bold leading-tight align-middle ${tap.is_gmc ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                  {tap.is_gmc ? 'GMC' : 'WIC'}
                                </span>
                                {tap.undone ? (
                                  <span
                                    onClick={tapItem ? () => openEditGridItem(tapItem.id) : undefined}
                                    className={`text-[12px] leading-tight font-semibold line-through text-red-600 ${isDesktop ? '' : 'break-words'} ${tapItem ? 'cursor-pointer hover:text-red-800' : ''}`}
                                  >
                                    {tap.item_name}
                                  </span>
                                ) : (
                                  renderClickableItemName(tap.item_name, `text-[12px] leading-tight font-semibold ${isDesktop ? '' : 'break-words'} text-gray-900`)
                                )}
                              </td>
                              <td className="leading-none px-0.5 py-0 text-left">
                                {(() => {
                                  const cname = tap.customer_name ?? tap.buyer_name ?? tap.customer_id_code ?? tap.buyer_phone
                                  const labelOnly = !tap.customer_id_code && !tap.buyer_phone && !tap.customer_phone && !!tap.buyer_name
                                  return (
                                    <button type="button" disabled={tap.undone} onClick={() => setTapCustomerSheet(tap)}
                                      title={labelOnly ? `${cname} - label only (not a customer). Tap to save as a customer` : cname ? `${cname} - tap for WhatsApp / change` : 'Add the customer for this sale'}
                                      className={`max-w-[64px] truncate text-[12px] leading-none font-semibold whitespace-nowrap ${labelOnly ? 'italic text-gray-500' : cname ? 'text-green-700' : 'text-gray-300'}`}>
                                      {cname ?? '＋'}
                                    </button>
                                  )
                                })()}
                                {tap.invoice_id && (
                                  <a href={`/receipts/${tap.invoice_id}/print`} target="_blank" rel="noopener noreferrer"
                                    title={`Receipt ${tap.invoice_number ?? ''}: tap to view or reprint`}
                                    className="block max-w-[64px] truncate text-[12px] leading-tight font-semibold text-orange-600 underline">
                                    🧾 {tap.invoice_number ?? 'Receipt'}
                                  </a>
                                )}
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                {tap.wa_sent_at && !tap.undone && (
                                  <span className="text-[12px] leading-none font-bold text-green-600"
                                    title={`Sent on WhatsApp ${new Date(tap.wa_sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}>✓</span>
                                )}
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[12px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-red-600' : 'text-blue-600'}`}>
                                  ₵{formatPrice(Number(tap.price) * tap.quantity)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className="text-[12px] leading-none text-gray-500 whitespace-nowrap">{fmtTime(tap.tapped_at)}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[12px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                  ₵{formatPrice(tap.price)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[12px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                  ₵{formatPrice(tapCostPrice)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right">
                                <span className={`text-[12px] leading-none font-semibold whitespace-nowrap ${tap.undone ? 'text-red-600' : tapProfit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                  ₵{formatPrice(tapProfit)}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className={`text-[12px] leading-none font-semibold ${tap.undone ? 'text-red-600' : 'text-gray-900'}`}>
                                  {tap.quantity}
                                </span>
                              </td>
                              <td className="leading-none px-0.5 py-0" title={tap.staff_name}>
                                <span className="text-[12px] leading-none text-gray-600 whitespace-nowrap">{staffInitials(tap.staff_name)}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-center">
                                <span className="text-[12px] leading-none text-gray-500 whitespace-nowrap">{tap.soh !== null && tap.soh !== undefined ? Math.ceil(tap.soh) : '-'}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0 text-right" title={isNewest ? 'Until last sign-out' : isOldest ? 'Since shop opening' : 'Since previous tap'}>
                                <span className="text-[12px] leading-none text-gray-500 whitespace-nowrap">{gapMins !== null ? formatGapMins(gapMins) : '-'}</span>
                              </td>
                              <td className="leading-none px-0.5 py-0">
                                <div className="flex items-center justify-center gap-0.5">
                                  {!tap.undone && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setLiveEditingTapId(tap.id)
                                          setLiveEditingTapTime(tap.tapped_at.slice(0, 16))
                                        }}
                                        title="Edit time"
                                        className="text-[12px] font-bold text-blue-600 hover:bg-blue-100 rounded leading-none p-0 border-0"
                                      >
                                        🕐
                                      </button>
                                      <button
                                        onClick={() => openEmbed(`/pending-jobs?fromTap=${tap.id}`)}
                                        title="Make this sale (paid in full) a pending job: the customer left work to be done or collected"
                                        className="text-[12px] font-bold text-amber-700 hover:bg-amber-100 rounded leading-none p-0 border-0"
                                      >
                                        🧾
                                      </button>
                                      <button
                                        onClick={() => undoTap(tap.id)}
                                        title="Undo"
                                        className="text-[12px] font-bold text-red-600 hover:bg-red-100 rounded leading-none p-0 border-0"
                                      >
                                        ↩
                                      </button>
                                    </>
                                  )}
                                  {tap.undone && <span className="text-[12px] font-bold leading-none text-red-600">CANCELLED</span>}
                                </div>
                              </td>
                            </tr>
                            )
                          })}
                          {/* Record lines: on the day receipt but not tapped (history back to 2023, lines typed in by
                              hand). Read-only. */}
                          {!logBarsOnly && logDay.lines.map(l => {
                            const q = l.quantity == null ? null : Number(l.quantity)
                            const amt = Number(l.item_total ?? 0)
                            const cp = l.item_id ? (liveCostPriceByItemId.get(l.item_id) ?? null) : null
                            const pf = q !== null && cp !== null ? amt - cp * q : null
                            return (
                              <tr key={`rec-${l.id}`} title="Recorded on the day receipt (not tapped). Read-only.">
                                <td className={`sticky left-0 z-[1] leading-tight px-0.5 py-0.5 ${isDesktop ? 'whitespace-nowrap' : 'max-w-[118px] min-w-[96px]'} align-top bg-gray-50`}>
                                  <span className={`inline-block rounded px-0.5 mr-0.5 text-[12px] font-bold leading-tight align-middle ${l.is_gmc ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>{l.is_gmc ? 'GMC' : 'REC'}</span>
                                  <span className={`text-[12px] leading-tight font-semibold text-gray-700 ${isDesktop ? '' : 'break-words'}`}>{l.item_name}</span>
                                </td>
                                <td className="bg-gray-50" />
                                <td className="bg-gray-50" />
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-right"><span className="text-[12px] font-semibold whitespace-nowrap text-gray-700">₵{formatPrice(amt)}</span></td>
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-center"><span className="text-[12px] text-gray-400">record</span></td>
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-right"><span className="text-[12px] whitespace-nowrap text-gray-700">{l.item_price != null ? `₵${formatPrice(Number(l.item_price))}` : '—'}</span></td>
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-right"><span className="text-[12px] whitespace-nowrap text-gray-500">{cp !== null ? `₵${formatPrice(cp)}` : '—'}</span></td>
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-right"><span className={`text-[12px] whitespace-nowrap ${pf !== null && pf < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{pf !== null ? `₵${formatPrice(pf)}` : '—'}</span></td>
                                <td className="bg-gray-50 leading-none px-0.5 py-0 text-center"><span className="text-[12px] text-gray-700">{q !== null ? q : '—'}</span></td>
                                <td className="bg-gray-50" />
                                <td className="bg-gray-50" />
                                <td className="bg-gray-50" />
                                <td className="bg-gray-50" />
                              </tr>
                            )
                          })}
                        </Fragment>
                      )
                    })}</>)
}
