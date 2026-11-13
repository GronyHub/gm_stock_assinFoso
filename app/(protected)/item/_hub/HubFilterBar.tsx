'use client'
import { Fragment } from 'react'
import PageToolbar from '@/lib/pageToolbar'
import PageGuide from '@/components/PageGuide'
import { CountsTab, COMPACT_SELECT_CLS, COMPACT_SELECT_STYLE, type Item } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubFilterBar({ h }: { h: HubCtx }) {
  const { outerTab, group, lossView, search, violation, liveExpanded, liveProductTypeFilter, setLiveProductTypeFilter, liveGroupFilter, setLiveGroupFilter, liveGmcTypeFilter, setLiveGmcTypeFilter, setLiveSortOrderModalOpen, liveMode, itemsPageMode, liveSaleFilter, setLiveSaleFilter, items, liveGroups, openEmbed, showControls, inCountTab, isDesktop, isOwnerOrJoe, liveCurrentView, setLiveCurrentView, liveSalesRadioValue, liveNegSohCount, liveSaleFilterFlags, activeFlagValue, pickLiveFlag, renderCriticalBar, pickSaleFilter, pickSalesView, renderTabSwitcher, renderModeProgressSummary, renderLiveSearchControls } = h
  return (<>{outerTab === 'loss' && (lossView === 'items' || lossView === 'sales' || lossView === 'pl' || lossView === 'cab' || lossView === 'customers') && (
            <div className="shrink-0 bg-white border-b border-gray-200">
              {/* Tab switcher: Items vs Live Sale modes -- a 3-column grid
                  (rather than flex+justify-between) so the tabs stay
                  centered in the row when the right-side controls are there
                  (Items' columns picker) or, on mobile where every pixel of
                  width matters for this row, sit flush against a genuinely
                  empty left column (most lossViews) instead of leaving a
                  wasted equal-width gap opposite nothing.
                  The two outer columns are `auto` (shrink to their own
                  content, 0px when the placeholder div is empty), NOT `1fr`
                  -- `1fr` on all three columns used to hand the empty left
                  spacer and the middle tab row an equal one-third share each
                  regardless of whether the right column had anything in it,
                  which left the switcher scrolling within barely a third of
                  the screen on a phone even before this row grew to 8 tabs.
                  The middle column is `minmax(0, 1fr)`, not plain `auto` --
                  with plain `auto`, justify-self-center used to size this
                  column to its own max-content width (fitting every tab
                  button with no clipping at all) instead of the space
                  actually available, so overflow-x-auto below never had
                  anything to scroll: the row just grew past the screen edge
                  instead of scrolling, silently hiding whichever tabs didn't
                  fit (worse the more tabs got added -- Manage/Advert/Grony
                  1-10 checks is what made it visible on a phone).
                  minmax(0, 1fr) caps the track at the space actually left
                  over after the two outer columns and lets it shrink to 0,
                  so the child below is properly width-constrained and its
                  own overflow-x-auto can do its job.
                  On desktop the tab buttons themselves live in Nav's bar
                  (above), so this row only needs the Items columns picker;
                  it drops out entirely (via the outer condition below) when
                  there's nothing to show, which is the common case (Sales
                  view, or Items view before customizing columns). */}
              {lossView === 'items' && liveMode === 'sale' && renderModeProgressSummary(true, true) && (
                <div className="px-6 py-1 border-b border-gray-200">{renderModeProgressSummary(true, true)}</div>
              )}
              {/* The old columns-picker strip (drawn white on white) is gone on every screen size -- it only left a blank
                  band above the filters. Alias Wide / Service Matches are still in the Filter drop-down. */}
              {/* Row 2: filter bar — hidden on report-style submenus. Type/
                  Groups/Filter all share one row now -- Filter used to spill
                  onto its own row by itself since it lived in a separate
                  conditional block with its own wrapping div. */}
              {showControls && outerTab === 'loss' && (liveMode === 'sale' || liveMode === 'log') && (
                <PageToolbar inline={liveExpanded} inlineClassName="w-full flex items-center gap-0.5 px-1.5 py-0.5 bg-white border-b border-gray-200">
                  {liveMode === 'sale' && <PageGuide page="sale" />}
                  {(lossView === 'sales' || lossView === 'items') && (<>
                  <select
                    value={liveProductTypeFilter}
                    onChange={e => setLiveProductTypeFilter(e.target.value as 'all' | 'goods' | 'services')}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="all">All</option>
                    <option value="goods">Goods</option>
                    <option value="services">Services</option>
                  </select>
                  <select
                    value={liveGroupFilter || ''}
                    onChange={e => setLiveGroupFilter(e.target.value || null)}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="">Groups</option>
                    {liveGroups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  </>)}
                  {/* No flags on the Grony Cash pages: they all live on the Flags page in the left sidebar (Negative Stock first). */}
                  <select
                    value={liveGmcTypeFilter ? `gmc:${liveGmcTypeFilter}` : liveSaleFilter ? liveSaleFilter.kind === 'interval' ? `interval:${liveSaleFilter.label}` : liveSaleFilter.kind === 'flag' ? `flag:${liveSaleFilter.key}` : liveSaleFilter.kind : liveCurrentView?.kind === 'violation' ? `violation:${liveCurrentView.key}` : liveCurrentView?.kind === 'aliasWide' ? 'view:aliasWide' : liveCurrentView?.kind === 'serviceMatches' ? 'view:serviceMatches' : liveCurrentView?.kind === 'gmcPacks' ? 'view:gmcPacks' : liveCurrentView?.kind === 'newItem' ? 'view:newItem' : ''}
                    onChange={e => {
                      const v = e.target.value
                      const selectEl = e.target as HTMLSelectElement
                      if (!v) {
                        setLiveSaleFilter(null)
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                      } else if (v.startsWith('interval:')) {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: 'interval', label: v.slice('interval:'.length) })
                      } else if (v.startsWith('violation:')) {
                        setLiveSaleFilter(null)
                        setLiveGmcTypeFilter(null)
                        const violationKey = v.slice('violation:'.length)
                        setLiveCurrentView({ kind: 'violation' as const, key: violationKey })
                      } else if (v.startsWith('flag:')) {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: 'flag', key: v.slice('flag:'.length) })
                      } else if (v.startsWith('view:')) {
                        setLiveSaleFilter(null)
                        setLiveGmcTypeFilter(null)
                        const viewKey = v.slice('view:'.length)
                        if (viewKey === 'aliasWide') setLiveCurrentView({ kind: 'aliasWide' as const })
                        else if (viewKey === 'serviceMatches') setLiveCurrentView({ kind: 'serviceMatches' as const })
                        else if (viewKey === 'gmcPacks') setLiveCurrentView({ kind: 'gmcPacks' as const })
                        else if (viewKey === 'newItem') setLiveCurrentView({ kind: 'newItem' as const })
                      } else if (v.startsWith('gmc:')) {
                        setLiveSaleFilter(null)
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(v.slice('gmc:'.length))
                      } else if (v === 'help:help') {
                        // Opens the Help Guide modal
                        openEmbed('/how-to')
                        selectEl.value = ''
                      } else if (v === 'settings:sortorder') {
                        setLiveSortOrderModalOpen(true)
                        selectEl.value = ''
                      } else {
                        setLiveCurrentView(null)
                        setLiveGmcTypeFilter(null)
                        setLiveSaleFilter({ kind: v as 'loss' | 'gain' | 'count_0' | 'count_1' })
                      }
                    }}
                    className={`${COMPACT_SELECT_CLS} border-gray-300 bg-white text-gray-900 flex-1 min-w-0`}
                    style={COMPACT_SELECT_STYLE}
                  >
                    <option value="">Filter</option>
                    <optgroup label="Help">
                      <option value="help:help">❓ Help Guide</option>
                    </optgroup>
                    <optgroup label="Settings">
                      <option value="settings:sortorder">⇅ Arrange Item Order</option>
                    </optgroup>
                    {liveSaleFilterFlags.filter(f => !f.key.startsWith('flag_')).map(f => {
                      let value = f.key
                      if (f.key.startsWith('interval_')) value = `interval:${f.label}`
                      return (
                        <option key={f.key} value={value}>
                          {f.label} ({f.count})
                        </option>
                      )
                    })}
                    <optgroup label="Views">
                      <option value="view:aliasWide">Alias Wide Table</option>
                      <option value="view:serviceMatches">Service Matches</option>
                      <option value="view:gmcPacks">GMC Packs</option>
                      {isOwnerOrJoe && <option value="view:newItem">+ New Item</option>}
                    </optgroup>
                    <optgroup label="GMC Types">
                      <option value="gmc:none">None</option>
                      <option value="gmc:gmc">GMC only, no service</option>
                      <option value="gmc:service_no_gmc">Service only</option>
                      <option value="gmc:pack_to_gmc">Pack → GMC</option>
                      <option value="gmc:service_using_gmc">Service uses GMC</option>
                    </optgroup>
                  </select>
                  {/* Desktop only: Search/WIC-GMC/Analytics move up onto this
                      same row (see isDesktop below) instead of getting their
                      own row underneath (see Row 3, now desktop-only false)
                      -- frees a full row's height for the item grid below on
                      a screen with room to spare, unlike mobile where these
                      still need their own row to stay tappable. */}
                  {isDesktop && (lossView === 'sales' || lossView === 'items') && renderLiveSearchControls(true)}
                </PageToolbar>
              )}
              {/* Sale mode filter bar -- now Sale/Log/Receipts' shared row
                  (see the merged "Sales" tab, renderTabSwitcher above): Live
                  plus the rest of these filters only ever apply to the tap-
                  to-sell grid, so picking one also jumps back to it via
                  pickSaleFilter (in case Log/Receipts was showing) and each
                  one's own checked state requires itemsPageMode === 'sale'
                  too, so a stale filter value doesn't show as active while
                  actually looking at Log or Receipts. */}
              {/* Records/Loss by Date/Loss by Items moved to Count's own
                  small sub-nav below (see inCountTab) -- this row is Sale
                  mode's own filter/browse row now, so it hides entirely
                  while Count's full-page content has taken over the screen
                  rather than floating a second, unrelated filter row above
                  it (Count has nothing to filter by group/type/violation --
                  its sub-nav is the only picker it needs). */}
              {showControls && (liveMode === 'sale' || liveMode === 'sales') && !inCountTab && (
                <div className="px-2 py-0.5 border-b border-green-700 flex flex-wrap items-center gap-0 text-[9px]">
                  {/* View-only filters (black) -- All(V) retired: bundling
                      every violation into one button made it impossible to
                      point a staff member at just the one thing to fix.
                      Every violation it used to be the only way to see is
                      now its own dedicated button in the red "action-
                      required" group below instead. */}
                  {/* Live / Log / Receipts radios removed -- each has its own sidebar row. */}

                  {itemsPageMode === 'sales' && (<>
                  {[
                    { key: 'history', label: 'RC History' },
                    { key: 'bars_only', label: 'RC Bars Only' },
                    { key: 'gmc', label: 'RC GMC' },
                    { key: 'wic', label: 'RC WIC' },
                  ].map(v => (
                    <Fragment key={v.key}>
                      <span className="text-gray-400 px-1">·</span>
                      <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700">
                        <input type="radio" name="liveViolationFilter" checked={itemsPageMode === 'sales' && liveSalesRadioValue === v.key} onChange={() => pickSalesView(v.key)} className="cursor-pointer w-3 h-3" />
                        <span>{v.label}</span>
                      </label>
                    </Fragment>
                  ))}
                  </>)}
                </div>
              )}
              {/* Count Due and Negative SOH used to share a small sub-nav
                  here (plus a "Records" option) -- retired, since each is
                  now its own full page reached only from the Critical bar
                  (see renderCriticalBar), with no in-page picker to jump
                  between them or to a Records view (that full history/edit
                  list lives on its own sidebar page instead, lossView
                  'counts', CountsTab.tsx). */}
              {/* Row 3: search bar + controls — mobile only now (see the
                  filter-bar row above, which absorbs these on desktop
                  instead so the item grid gets that row's height back).
                  Also hidden on report-style submenus, and on Sales/Bills
                  (they render their own title+search+analytics+help row
                  inside their own liveMode block instead). Global Search's
                  own 🔍 now lives once, next to the tab switcher above, not
                  repeated here. */}
              {!isDesktop && showControls && (liveMode === 'sale' || liveMode === 'log') && (
                <div className="px-2 py-1 border-b border-green-700">
                  <div className="flex items-center gap-2">
                    {(lossView === 'sales' || lossView === 'items') && renderLiveSearchControls(true)}
                  </div>
                </div>
              )}
            </div>
          )}</>)
}
