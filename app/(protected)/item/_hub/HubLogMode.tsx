'use client'
import { isOwnerLevel } from '@/lib/roles'
import PageToolbar from '@/lib/pageToolbar'
import PageGuide, { LawsSheet } from '@/components/PageGuide'
import { useState } from 'react'
import { areaForGuide } from '@/lib/lawAreas'
import type { HubCtx } from './useHubState'
import HubLogAnalytics from './HubLogAnalytics'

export default function HubLogMode({ h }: { h: HubCtx }) {
  const [lawsOpen, setLawsOpen] = useState(false)   // the Sales Log's Laws sheet (Rules, Done, Not done)
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
                {/* Phone: period, what to show, and two menus. Everything else the row used to carry is in the menus. */}
                <div className="flex w-full flex-col gap-2 sm:max-w-md sm:ml-auto">
                  <div className="flex gap-2">
                    <select value={logPeriod.y ?? ''} onChange={e => setLogPeriod({ y: e.target.value ? Number(e.target.value) : null, m: null })} aria-label="Period"
                      className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-2 text-[14px] font-medium text-gray-800">
                      <option value="">Last 90 days</option>
                      {logYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {logPeriod.y && (
                      <select value={logPeriod.m ?? ''} onChange={e => setLogPeriod(p => ({ ...p, m: e.target.value ? Number(e.target.value) : null }))} aria-label="Month"
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white p-2 text-[14px] font-medium text-gray-800">
                        <option value="">Whole year</option>
                        {['January','February','March','April','May','June','July','August','September','October','November','December'].map((mn, i) => <option key={mn} value={i + 1}>{mn}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div role="group" aria-label="Show" className="flex flex-1 overflow-hidden rounded-lg border border-gray-300 text-[13px] font-semibold">
                      <button type="button" aria-pressed={logShowW} onClick={() => setLogShowW(v => !v)} className={`flex-1 py-2 ${logShowW ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 line-through'}`}>WIC</button>
                      <button type="button" aria-pressed={logShowG} onClick={() => setLogShowG(v => !v)} className={`flex-1 border-x border-gray-300 py-2 ${logShowG ? 'bg-purple-600 text-white' : 'bg-white text-gray-400 line-through'}`}>GMC</button>
                      <button type="button" aria-pressed={logBarsOnly} onClick={() => setLogBarsOnly(v => !v)} className={`flex-1 py-2 ${logBarsOnly ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}>Totals</button>
                    </div>
                    <details className="relative">
                      <summary className="flex min-h-[40px] cursor-pointer list-none items-center rounded-lg bg-green-100 px-3 text-[13px] font-semibold text-green-800 [&::-webkit-details-marker]:hidden">＋ Add</summary>
                      <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-[14px] shadow-xl">
                        <button type="button" className="block w-full px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setMiDate(new Date(Date.now() - 86400000).toISOString().slice(0, 10)); setMiOn(true) }}>Sale for a past day</button>
                        <button type="button" className="block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setLiveNewEntryOpen(true) }}>New log entry</button>
                        <button type="button" className="block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setRcptSelect(v => !v); setRcptSel(new Set()) }}>{rcptSelect ? 'Cancel receipt' : 'Receipt from sales…'}</button>
                        {areaForGuide('log') && <><button type="button" className="block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setLawsOpen(true) }}>📜 Laws for this page</button>{lawsOpen && <LawsSheet areaKey={areaForGuide('log')!.key} label={areaForGuide('log')!.label} onClose={() => setLawsOpen(false)} />}</>}
                      </div>
                    </details>
                    <details className="relative">
                      <summary aria-label="More" className="flex min-h-[40px] min-w-[40px] cursor-pointer list-none items-center justify-center rounded-lg bg-gray-100 text-lg text-gray-700 [&::-webkit-details-marker]:hidden">⋯</summary>
                      <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white text-[14px] shadow-xl">
                        <button type="button" className="block w-full px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setLogFlag(logFlag === 'history' ? '' : 'history') }}>{logFlag === 'history' ? 'Hide change history' : 'Change history'}</button>
                        <button type="button" className="block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50" onClick={e => { e.currentTarget.closest('details')?.removeAttribute('open'); setLiveLogShowAnalytics(a => !a) }}>{liveLogShowAnalytics ? 'Hide analytics' : 'Analytics'}</button>
                      </div>
                    </details>
                  </div>
                  {logFlag && logFlag !== 'history' && <button type="button" onClick={() => setLogFlag('')} className="self-start rounded-lg bg-red-600 px-3 py-1.5 text-[13px] font-bold text-white">Flag filter on ✕</button>}
                </div>
              </PageToolbar>
              {<HubLogAnalytics h={h} />}
            </div>
          )}</>)
}
