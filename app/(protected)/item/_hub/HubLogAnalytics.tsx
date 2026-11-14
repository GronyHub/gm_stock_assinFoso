'use client'
import { loading, SalesDaysSection, LiveSaleAnalyticsSection } from './hubShared'
import type { HubCtx } from './useHubState'
import HubLogFlags from './HubLogFlags'

export default function HubLogAnalytics({ h }: { h: HubCtx }) {
  const { liveTaps, liveTapsStatus, logWrapRef, liveLogShowAnalytics, liveTapsAll, logPeriod, logFlag, loadAllLiveTaps, logFlagDates, logDays } = h
  return (<>{liveLogShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><SalesDaysSection /><LiveSaleAnalyticsSection /></div>
              ) : (
              <div className="flex-1 overflow-auto" ref={logWrapRef}>
                {logFlagDates && (
                  <p className="px-2 py-1 text-[12px] text-red-700 bg-red-50 border-b border-red-100">
                    Showing the flagged days in this period ({logDays.length}). Pick a year in Period to see flagged days from other years.
                  </p>
                )}
                {<HubLogFlags h={h} />}
                {!logPeriod.y && !logFlag && liveTapsStatus === 'ok' && liveTaps.length > 0 && liveTapsAll !== 'yes' && (
                  <div className="py-3 text-center">
                    <button type="button" onClick={loadAllLiveTaps} disabled={liveTapsAll === 'loading'}
                      className="rounded-lg bg-gray-100 px-3 py-1 text-[12px] font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                      {liveTapsAll === 'loading' ? 'Loading older sales…' : 'Show older sales'}
                    </button>
                    <p className="mt-1 text-[12px] text-gray-400">Showing the last 90 days. For older sales and records (back to 2023), pick a year in Period.</p>
                  </div>
                )}
              </div>
              )}</>)
}
