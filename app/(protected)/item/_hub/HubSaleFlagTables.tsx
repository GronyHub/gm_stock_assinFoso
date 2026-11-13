'use client'
import { CABTab, ProfitLossTab, CountsTab, COMPACT_SELECT_CLS, COMPACT_SELECT_STYLE, type Item } from './hubShared'
import type { HubCtx } from './useHubState'
import HubSaleModeBody from './HubSaleModeBody'

export default function HubSaleFlagTables({ h }: { h: HubCtx }) {
  const { group, lossView, violation, cabConfirmSignal, liveExpanded, liveProductTypeFilter, setLiveProductTypeFilter, liveGroupFilter, setLiveGroupFilter, setLiveSortOrderModalOpen, liveMode, liveShowCountFullPage, liveSaleViolationFilter, items, openEmbed, groups, liveCurrentView, setLiveCurrentView, liveShowCountDue, setLiveShowCountDue, liveCatalogueGroups, liveComputedFlags, pickCountMode, renderLiveSearchControls, renderLiveItemFlagsFilter } = h
  return (<>{liveSaleViolationFilter === 'pl' || liveSaleViolationFilter === 'cab' ? (
              <div className="flex-1 overflow-auto">
                {liveSaleViolationFilter === 'cab' ? <CABTab openConfirmSignal={cabConfirmSignal} /> : <ProfitLossTab />}
              </div>
            ) : (
            <div className="contents">

            {/* Filter Bar -- Green bar at top, shown only while liveExpanded
                (this component's own top green bar already covers the
                type/group filters/laws/help the rest of the time -- see
                above -- and is visually hidden behind this fixed overlay
                once liveExpanded, so it needs its own copy here too rather
                than losing the type/group filters entirely). */}
            {liveExpanded && (
            <div className="bg-white border-b border-gray-200 -mx-0 px-1.5 py-0.5 flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-0.5 flex-wrap">
                  <div className="flex gap-0.5 items-center">
                    <select
                      value={liveProductTypeFilter}
                      onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                      className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 w-11`}
                      style={COMPACT_SELECT_STYLE}
                    >
                      <option value="all">All types</option>
                      <option value="goods">Goods</option>
                      <option value="services">Services</option>
                    </select>
                    <select
                      value={liveGroupFilter || ''}
                      onChange={e => setLiveGroupFilter(e.target.value || null)}
                      className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 w-14`}
                      style={COMPACT_SELECT_STYLE}
                    >
                      <option value="">All groups</option>
                      {liveCatalogueGroups.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-1 items-center">
                    <select
                      value={liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'lossByItem' ? 'view:lossByItem' : liveCurrentView?.kind === 'dailySummary' ? 'view:dailySummary' : ''}
                      onChange={e => {
                        const v = e.target.value
                        const selectEl = e.target as HTMLSelectElement
                        if (!v) {
                          setLiveCurrentView(null)
                        } else if (v.startsWith('violation:')) {
                          const violationKey = v.slice('violation:'.length)
                          setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                        } else if (v.startsWith('view:')) {
                          const viewKey = v.slice('view:'.length)
                          if (viewKey === 'lossByItem') setLiveCurrentView({ kind: 'lossByItem' as const })
                          else if (viewKey === 'dailySummary') setLiveCurrentView({ kind: 'dailySummary' as const })
                        } else if (v === 'help:help') {
                          openEmbed('/how-to')
                          selectEl.value = ''
                        } else if (v === 'settings:sortorder') {
                          setLiveSortOrderModalOpen(true)
                          selectEl.value = ''
                        }
                      }}
                      title="Views, help and settings"
                      className={`${COMPACT_SELECT_CLS} border-white text-gray-800 bg-white/80 hover:bg-white shrink-0 w-14`}
                      style={COMPACT_SELECT_STYLE}
                    >
                      <option value="">⚙ Views</option>
                      <optgroup label="Help">
                        <option value="help:help">❓ Help Guide</option>
                      </optgroup>
                      <optgroup label="Settings">
                        <option value="settings:sortorder">⇅ Arrange Item Order</option>
                      </optgroup>
                      <optgroup label="Views">
                        <option value="view:lossByItem">Loss by Item</option>
                        <option value="view:dailySummary">Daily Summary</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
                {/* Due for Count filter + Items Violation Flags Filter */}
                <div className="flex gap-1 flex-wrap px-0 items-center">
                  <label className="flex items-center gap-2 px-2 py-1 rounded bg-amber-400 hover:bg-amber-500 text-amber-900 font-semibold text-xs cursor-pointer transition">
                    <input type="checkbox" checked={liveShowCountDue} onChange={() => setLiveShowCountDue(d => !d)} className="cursor-pointer" />
                    🔄 Due for Count
                  </label>
                </div>
            </div>
            )}

            {/* Search & Controls -- rendered here only while liveExpanded (the
                fullscreen overlay hides this component's own footer, where
                these normally live -- see the footer's own Live branch
                below). */}
            {liveExpanded && (
              <div className="px-4 py-3 border-b border-gray-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2 items-center ml-auto">
                    {renderLiveSearchControls(false)}
                  </div>
                </div>
              </div>
            )}

            {/* The "Records" full-page view (with its own Records/History/
                Intervals sub-nav) that used to live here was retired --
                liveShowCountFullPage can no longer become true (see
                pickCountMode), so this whole block is unreachable. The full
                history/edit list now lives on its own sidebar page instead
                (lossView 'counts', CountsTab.tsx). */}

            {<HubSaleModeBody h={h} />}
            </div>
            )}</>)
}
