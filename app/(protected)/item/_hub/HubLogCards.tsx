'use client'
import { Fragment } from 'react'
import { fmtTime } from '@/lib/fmtDate'
import { formatGapMins } from '@/lib/fmtGap'
import DayCashCell from '../_components/DayCashCell'
import { DayMoneyLine, useDayMoney } from '../_components/DayMoney'
import LogDayPhotos from '../_components/LogDayPhotos'
import MoneyText from '@/components/MoneyText'
import type { Tap } from './hubShared'
import type { HubCtx } from './useHubState'

const nm = (n: string | null | undefined) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : '')

// A small label over a value: every figure of a sale is shown, none hidden.
function Fact({ label, children, tone = '' }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap">
      <dt className="text-[11px] text-gray-400">{label}</dt>
      <dd className={`text-[12px] tabular-nums ${tone || 'text-gray-700'}`}>{children}</dd>
    </div>
  )
}

// The Sales Log on a phone: one card per sale (item and total first, then customer and time), then price, cost, profit, quantity, staff, stock and gap,
// then the actions. The wide table is for computers.
export default function HubLogCards({ h }: { h: HubCtx }) {
  const { logDays, logBarsOnly, liveDayBounds, liveCostPriceByItemId, liveAllItems, renderClickableItemName, setTapCustomerSheet, rcptSelect, rcptSel, setRcptSel,
    setLiveEditingTapId, setLiveEditingTapTime, openEmbed, undoTap, setLiveEditingFullTapId, setLiveEditingCurrentDate, openEditGridItem, jobMoneyOn, setLiveTaps, setLogRecs } = h
  const dayMoney = useDayMoney()
  return (
    <div className="sm:hidden">
      {logDays.map(([date, logDay]) => {
        const dateTaps = (logDay.taps || []).filter((t): t is Tap => t != null)
        const recTotal = logDay.lines.reduce((s, l) => s + Number(l.item_total ?? 0), 0)
        const recProfit = logDay.lines.reduce((s, l) => {
          const cp = l.item_id ? liveCostPriceByItemId.get(l.item_id) : undefined
          return s + (cp !== undefined && l.quantity != null ? Number(l.item_total ?? 0) - cp * Number(l.quantity) : 0)
        }, 0)
        const live = dateTaps.filter(t => !t.undone)
        const dateTotal = live.reduce((s, t) => s + Number(t.price) * t.quantity, 0) + recTotal + jobMoneyOn(date)
        const dateProfit = live.reduce((s, t) => s + (Number(t.price) - (liveCostPriceByItemId.get(t.item_id) ?? 0)) * t.quantity, 0) + recProfit
        const wicRec = logDay.receipts.find(r => !r.is_gmc) ?? null
        const wic = dateTaps.filter(t => !t.is_gmc)
        const rid = wicRec?.id ?? wic.find(t => t.receipt_id)?.receipt_id ?? null
        const ccRaw = wicRec ? wicRec.cash_counted : wic.find(t => t.receipt_id === rid)?.receipt_cash_counted
        const cc = ccRaw === null || ccRaw === undefined || ccRaw === '' ? null : Number(ccRaw)
        const rtRaw = wicRec ? wicRec.total : wic.find(t => t.receipt_id === rid)?.receipt_total
        const wicTotal = rtRaw !== null && rtRaw !== undefined && rtRaw !== '' ? Number(rtRaw) : wic.filter(t => !t.undone).reduce((s, t) => s + Number(t.price) * t.quantity, 0)
        const okForReceipt = dateTaps.filter(t => !t.undone && !t.invoice_id)
        return (
          <section key={date} id={`log-day-${date}`} aria-label={date}>
            <header className="sticky top-0 z-10 border-y border-green-200 bg-green-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-green-800">
                  {rcptSelect && okForReceipt.length > 0 && (
                    <input type="checkbox" className="h-4 w-4 accent-orange-500" aria-label="Select this day's sales without a receipt"
                      checked={okForReceipt.every(t => rcptSel.has(t.id))}
                      onChange={e => setRcptSel(prev => { const n = new Set(prev); okForReceipt.forEach(t => e.target.checked ? n.add(t.id) : n.delete(t.id)); return n })} />
                  )}
                  {new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <button type="button" onClick={() => { setLiveEditingFullTapId(-1); setLiveEditingCurrentDate(date) }} className="rounded-lg bg-white px-3 py-1 text-[13px] font-semibold text-green-800">Edit</button>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                <span className="text-gray-600">Sales <b className="text-[15px] text-gray-900"><MoneyText v={dateTotal} /></b></span>
                <span className="text-gray-600">Profit <b className={dateProfit < 0 ? 'text-red-600' : 'text-green-700'}><MoneyText v={dateProfit} /></b></span>
                <span className="inline-flex items-center gap-1.5">
                  <DayCashCell receiptId={rid} cashCounted={cc} salesTotal={wicTotal}
                    onSaved={(v, total) => {
                      setLiveTaps(prev => prev.map(t => t.receipt_id === rid ? { ...t, receipt_cash_counted: v, ...(total !== null ? { receipt_total: total } : {}) } : t))
                      setLogRecs(p => p ? { ...p, receipts: p.receipts.map(r => r.id === rid ? { ...r, cash_counted: String(v), ...(total !== null ? { total: String(total) } : {}) } : r) } : p)
                    }} />
                  {logDay.receipts.length > 0 && <LogDayPhotos receipts={logDay.receipts} />}
                </span>
              </div>
              <DayMoneyLine f={dayMoney.get(date)} className="mt-1" />
            </header>

            {!logBarsOnly && (
              <ul>
                {dateTaps.map((tap, i) => {
                  const bounds = liveDayBounds[date]
                  const isOldest = i === dateTaps.length - 1
                  const isNewest = i === 0
                  let gapMins: number | null = null
                  if (isNewest && bounds?.closeTime) gapMins = (new Date(bounds.closeTime).getTime() - new Date(tap.tapped_at).getTime()) / 60000
                  else if (isOldest && bounds?.openTime) gapMins = (new Date(tap.tapped_at).getTime() - new Date(bounds.openTime).getTime()) / 60000
                  else if (dateTaps[i + 1]) gapMins = (new Date(tap.tapped_at).getTime() - new Date(dateTaps[i + 1].tapped_at).getTime()) / 60000
                  const cost = liveCostPriceByItemId.get(tap.item_id) ?? 0
                  const profit = (Number(tap.price) - cost) * tap.quantity
                  const tapItem = liveAllItems.find(it => it.name.toLowerCase() === tap.item_name.toLowerCase())
                  const cname = tap.customer_name ?? tap.buyer_name ?? tap.customer_id_code ?? tap.buyer_phone
                  const labelOnly = !tap.customer_id_code && !tap.buyer_phone && !tap.customer_phone && !!tap.buyer_name
                  return (
                    <li key={tap.id} className={`border-b border-gray-100 px-3 py-2 ${tap.undone ? 'bg-red-50' : 'bg-white'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 flex-1 items-start gap-2">
                          {rcptSelect && (
                            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-orange-500" disabled={tap.undone || !!tap.invoice_id} aria-label="Add to receipt"
                              checked={rcptSel.has(tap.id)}
                              onChange={e => setRcptSel(prev => { const n = new Set(prev); if (e.target.checked) n.add(tap.id); else n.delete(tap.id); return n })} />
                          )}
                          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${tap.is_gmc ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{tap.is_gmc ? 'GMC' : 'WIC'}</span>
                          {tap.undone
                            ? <span onClick={tapItem ? () => openEditGridItem(tapItem.id) : undefined} className="break-words text-[15px] font-medium leading-snug text-red-600 line-through">{tap.item_name}</span>
                            : renderClickableItemName(tap.item_name, 'text-[15px] font-medium leading-snug break-words text-gray-900')}
                        </p>
                        <span className={`shrink-0 text-[17px] font-semibold tabular-nums ${tap.undone ? 'text-red-600 line-through' : 'text-blue-700'}`}><MoneyText v={Number(tap.price) * tap.quantity} /></span>
                      </div>

                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-600">
                        <button type="button" disabled={tap.undone} onClick={() => setTapCustomerSheet(tap)}
                          className={`max-w-[55%] truncate rounded-full px-2.5 py-1 text-[13px] font-medium ${labelOnly ? 'bg-gray-100 italic text-gray-600' : cname ? 'bg-green-50 text-green-800' : 'border border-dashed border-gray-300 text-gray-500'}`}>
                          {cname ?? '＋ Customer'}
                        </button>
                        <span>{fmtTime(tap.tapped_at)}</span>
                        <span>× {tap.quantity}</span>
                        {tap.wa_sent_at && !tap.undone && <span className="font-semibold text-green-700" title="Sent on WhatsApp">✓ WhatsApp</span>}
                        {tap.invoice_id && <a href={`/receipts/${tap.invoice_id}/print`} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 underline">🧾 {tap.invoice_number ?? 'Receipt'}</a>}
                      </p>

                      <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <Fact label="Price"><MoneyText v={Number(tap.price)} /></Fact>
                        <Fact label="Cost"><MoneyText v={cost} /></Fact>
                        <Fact label="Profit" tone={profit < 0 ? 'text-red-600' : 'text-emerald-700'}><MoneyText v={profit} /></Fact>
                        <Fact label="Staff">{nm(tap.staff_name)}</Fact>
                        <Fact label="Stock">{tap.soh !== null && tap.soh !== undefined ? Math.ceil(tap.soh) : '–'}</Fact>
                        <Fact label={isNewest ? 'To sign-out' : isOldest ? 'From opening' : 'Gap'}>{gapMins !== null ? formatGapMins(gapMins) : '–'}</Fact>
                      </dl>

                      {tap.undone ? (
                        <p className="mt-2 text-[12px] font-bold text-red-600">CANCELLED</p>
                      ) : (
                        <div className="mt-1.5 flex gap-1.5">
                          <button type="button" onClick={() => { setLiveEditingTapId(tap.id); setLiveEditingTapTime(tap.tapped_at.slice(0, 16)) }} className="min-h-[32px] flex-1 rounded-lg bg-gray-100 text-[12px] font-semibold text-blue-700">🕐 Edit time</button>
                          <button type="button" onClick={() => openEmbed(`/pending-jobs?fromTap=${tap.id}`)} className="min-h-[32px] flex-1 rounded-lg bg-gray-100 text-[12px] font-semibold text-amber-700">🧾 Make a job</button>
                          <button type="button" onClick={() => undoTap(tap.id)} className="min-h-[32px] flex-1 rounded-lg bg-gray-100 text-[12px] font-semibold text-red-600">↩ Undo</button>
                        </div>
                      )}
                    </li>
                  )
                })}

                {logDay.lines.map(l => {
                  const q = l.quantity == null ? null : Number(l.quantity)
                  const amt = Number(l.item_total ?? 0)
                  const cp = l.item_id ? (liveCostPriceByItemId.get(l.item_id) ?? null) : null
                  const pf = q !== null && cp !== null ? amt - cp * q : null
                  return (
                    <li key={`rec-${l.id}`} className="border-b border-gray-100 bg-gray-50 px-3 py-2.5" title="Recorded on the day receipt (not tapped). Read-only.">
                      <div className="flex items-start justify-between gap-3">
                        <p className="flex min-w-0 flex-1 items-start gap-2">
                          <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${l.is_gmc ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-600'}`}>{l.is_gmc ? 'GMC' : 'REC'}</span>
                          <span className="break-words text-[15px] font-medium leading-snug text-gray-700">{l.item_name}</span>
                        </p>
                        <span className="shrink-0 text-[17px] font-semibold tabular-nums text-gray-700"><MoneyText v={amt} /></span>
                      </div>
                      <dl className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <Fact label="Price">{l.item_price != null ? <MoneyText v={Number(l.item_price)} /> : '–'}</Fact>
                        <Fact label="Cost">{cp !== null ? <MoneyText v={cp} /> : '–'}</Fact>
                        <Fact label="Profit" tone={pf !== null && pf < 0 ? 'text-red-600' : 'text-emerald-700'}>{pf !== null ? <MoneyText v={pf} /> : '–'}</Fact>
                        <Fact label="Quantity">{q !== null ? q : '–'}</Fact>
                        <Fact label="Source">Day record</Fact>
                      </dl>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
