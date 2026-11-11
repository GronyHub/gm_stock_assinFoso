'use client'
import { isOwnerLevel } from '@/lib/roles'
import PageToolbar from '@/lib/pageToolbar'
import PageGuide from '@/components/PageGuide'
import type { HubCtx } from './useHubState'
import HubLogAnalytics from './HubLogAnalytics'

export default function HubLogMode({ h }: { h: HubCtx }) {
  const { liveExpanded, setLiveExpanded, liveMode, items, salesFlagsCount, session, rcptSelect, setRcptSelect, setRcptSel, setMiOn, setMiDate, liveReconcilingTaps, setLiveNewEntryOpen, liveRootClassName, liveLogShowAnalytics, setLiveLogShowAnalytics, logPeriod, setLogPeriod, logShowW, setLogShowW, logShowG, setLogShowG, logBarsOnly, setLogBarsOnly, logFlag, setLogFlag, logFlagsData, logYears, reconcileUndoneTaps, renderModeToggleRow } = h
  return (<>{liveMode === 'log' && (
            <div className={liveRootClassName}>
              {/* "Large screen" makes this root `fixed inset-0`, covering
                  this component's own top green bar/footer -- still mounted
                  underneath, just visually hidden. This floating button is
                  the actual way back out, reachable regardless of which mode
                  is showing or how far the content underneath has scrolled. */}
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <PageToolbar inline={liveExpanded} grow={false} inlineClassName="flex items-center justify-end px-1.5 py-1 border-b border-gray-100 gap-2">
                <PageGuide page="log" />
                <div className="flex flex-wrap justify-end items-center gap-1.5">
                  {/* Sales Rec / Summary's filters, now the Log's: Period, W / G, Bars only, Flags (+ History). */}
                  <select value={logPeriod.y ?? ''} onChange={e => setLogPeriod({ y: e.target.value ? Number(e.target.value) : null, m: null })}
                    title="Period: pick a year (and month) to see older sales and records, back to 2023"
                    className="shrink-0 rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-gray-800">
                    <option value="">Last 90 days</option>
                    {logYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {logPeriod.y && (
                    <select value={logPeriod.m ?? ''} onChange={e => setLogPeriod(p => ({ ...p, m: e.target.value ? Number(e.target.value) : null }))}
                      className="shrink-0 rounded border border-gray-300 bg-white px-1 py-0.5 text-[10px] font-semibold text-gray-800">
                      <option value="">Whole year</option>
                      {['January','February','March','April','May','June','July','August','September','October','November','December'].map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}
                    </select>
                  )}
                  <button type="button" onClick={() => setLogShowW(v => !v)} title="Walk-in (WIC) sales"
                    className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-bold ${logShowW ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 line-through'}`}>W</button>
                  <button type="button" onClick={() => setLogShowG(v => !v)} title="GMC (internal use)"
                    className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-bold ${logShowG ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400 line-through'}`}>G</button>
                  <button type="button" onClick={() => setLogBarsOnly(v => !v)} title="Show only each day's row (totals, cash counted, WNW, photos)"
                    className={`shrink-0 rounded px-1.5 py-1 text-[10px] font-bold ${logBarsOnly ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Bars only</button>
                  <select value={logFlag} onChange={e => setLogFlag(e.target.value)} title="Flags and history"
                    className={`shrink-0 max-w-[150px] rounded border px-1 py-0.5 text-[10px] font-semibold ${logFlag ? 'border-red-600 bg-red-600 text-white' : 'border-red-200 bg-red-50 text-red-700'}`}>
                    <option value="">🚩 Flags{salesFlagsCount ? ` (${salesFlagsCount})` : ''}</option>
                    {([['no_cash', 'No cash counted', 'noCash'], ['high_wnw', 'High WNW', 'highWnw'], ['sold_below_cost', 'Sold below cost', 'costGteSell'], ['missing_days', 'Missing days', 'missingDays'], ['dup_receipt', 'Duplicate receipts', 'dupReceipts']] as const).map(([k, label, dk]) => {
                      const list = logFlagsData?.[dk] as unknown[] | undefined
                      return <option key={k} value={k}>{label}{list ? ` (${list.length})` : ''}</option>
                    })}
                    <option value="history">History (changes)</option>
                  </select>
                  {isOwnerLevel(session?.user as any) && (
                    <button
                      type="button"
                      onClick={reconcileUndoneTaps}
                      disabled={liveReconcilingTaps}
                      title="Fix past undone sales that were never removed from totals"
                      className="shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] bg-gray-100 text-gray-600 hover:bg-gray-200 transition disabled:opacity-50"
                    >
                      {liveReconcilingTaps ? '…' : 'Fix undone sales'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setRcptSelect(v => !v); setRcptSel(new Set()) }}
                    title="Tick recorded sales and create a receipt for them"
                    className={`shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] transition ${rcptSelect ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                  >
                    {rcptSelect ? 'Cancel receipt' : 'Receipt…'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMiDate(new Date(Date.now() - 86400000).toISOString().slice(0, 10)); setMiOn(true) }}
                    title="Record a sale for a past day, with its customer and receipt (MI basket)"
                    className="shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] bg-green-100 text-green-700 hover:bg-green-200 transition"
                  >
                    + Past sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveNewEntryOpen(true)}
                    title="Add a new log entry"
                    className="shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                  >
                    + New
                  </button>
                  <button
                    type="button"
                    onClick={() => setLiveLogShowAnalytics(a => !a)}
                    title="Analytics"
                    className={`shrink-0 font-bold rounded-lg px-2 py-1 text-[10px] transition ${
                      liveLogShowAnalytics ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    📊
                  </button>
                </div>
              </PageToolbar>
              {<HubLogAnalytics h={h} />}
            </div>
          )}</>)
}
