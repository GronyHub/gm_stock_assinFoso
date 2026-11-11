'use client'
import { loading, LogFlagLists, type Item } from './hubShared'
import type { HubCtx } from './useHubState'
import HubLogRows from './HubLogRows'

export default function HubLogFlags({ h }: { h: HubCtx }) {
  const { shop, liveTapsStatus, logZoomFor, logPeriod, setLogPeriod, logRecsStatus, logPeriodTaps, logFlag, setLogFlag, logFlagsData, setLogFlagsData, loadLiveTapsFresh, logDays } = h
  return (<>{(logFlag === 'missing_days' || logFlag === 'dup_receipt' || logFlag === 'history') ? (
                  <LogFlagLists view={logFlag} flags={logFlagsData as never} onClose={() => setLogFlag('')}
                    onFixedMissing={d => setLogFlagsData(f => f ? { ...f, missingDays: ((f.missingDays as { missing_date: string }[]) ?? []).filter(x => x.missing_date !== d) } : f)}
                    onPickDate={d => { setLogFlag(''); setLogPeriod({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) }) }} />
                ) : logDays.length === 0 ? (
                  (logPeriod.y ? (logRecsStatus === 'loading' || logPeriodTaps === null) : liveTapsStatus === 'loading') ? (
                    <p className="text-sm text-gray-400 text-center py-8">Loading sales…</p>
                  ) : liveTapsStatus === 'error' ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-red-600">Couldn&apos;t load sales. Check the connection.</p>
                      <button type="button" onClick={loadLiveTapsFresh}
                        className="mt-2 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white hover:bg-blue-700">Retry</button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">No sales recorded</p>
                  )
                ) : (
                  // A real <table> instead of independent per-row grid divs --
                  // table-layout:auto sizes each column to exactly the widest
                  // cell actually in it (no wasted gap on rows with a shorter
                  // item name than others), while still keeping every column
                  // aligned down the page, which independent grids can't do
                  // on their own. Item's <th>/<td>s stay sticky left-0, the
                  // header row stays sticky top-0, and each date header
                  // spans the full row via a real colSpan -- all standard
                  // table equivalents of what the grid version did by hand.
                  <table className="border-collapse" style={{ zoom: logZoomFor(520) }}>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="sticky left-0 top-0 z-20 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-left whitespace-nowrap">Item</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-left whitespace-nowrap">Customer</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-center whitespace-nowrap" title="Message / receipt sent on WhatsApp">WA</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">Total</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">Time</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">SP</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">CP</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap">PF</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">Qty</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-left whitespace-nowrap">Staff</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase whitespace-nowrap">SOH</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5 text-[8px] leading-none font-semibold text-gray-600 uppercase text-right whitespace-nowrap" title="Time since the previous tap -- since shop opening for the day's first, until the last staff signed out for the day's last">Gap</th>
                        <th className="sticky top-0 z-10 bg-gray-50 h-[13px] px-0.5" />
                      </tr>
                    </thead>
                    <HubLogRows h={h} />
                  </table>
                )}</>)
}
