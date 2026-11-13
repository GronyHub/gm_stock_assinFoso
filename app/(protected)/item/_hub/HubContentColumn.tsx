'use client'
import FlagQuotaLine from '../_components/FlagQuotaLine'
import { MyAssignmentsSummary } from '../_components/MyAssignmentsSummary'
import PageToolbar from '@/lib/pageToolbar'
import PageGuide from '@/components/PageGuide'
import { MANAGE_LIST_ITEMS, type ManageView } from '../_components/manageViewData'
import { STAFF_TEAM_ITEMS, type StaffView } from '../_components/staffViewData'
import { type CHView } from '../_components/chViewData'
import SettingsHome from '../_components/SettingsHome'
import { STAFF_ADMIN_TEAM_ITEMS } from '../_components/staffViewData'
import { isOwnerLevel } from '@/lib/roles'
import { TabErrorBoundary, ExpenseOrdersPanel, Item360Page, ItemsTab, CABTab, TodayContent, NewItemForm, ItemsAnalyticsSection, ViolationsAnalyticsSection, LossTab, ProfitLossTab, DailySummaryTab, GronyManageContent, VendorsPage, CustomersPage, PurchaseOrdersPage, AliasWidePage, ServiceMatchesPage, GmcPacksPage, ViewPortalAsButton, StaffContent, StaffMemberPersonalTab, UKTab, CHTab, ReorderListsPanel, ActivityDurationsPanel, SalesTab, CountsTab, STAFF_ROSTER, MANAGE_VIEW_KEYS, isStaffView, type LossView, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'
import HubScrollArea from './HubScrollArea'

export default function HubContentColumn({ h }: { h: HubCtx }) {
  const { outerTab, lossView, itemsExtraView, search, violation, addForm, setAddForm, cabConfirmSignal, staffTimeSignal, vendorSignal, propertiesInitialTab, jumpToCountId, setJumpToCountId, liveGroupFilter, liveEmbeddedSearch, plSubView, jumpToLiveSaleTab, jumpToCustomersTab, customerSearchText, vendorSearchText, fixedCategoryIds, uk, ch, showAnalytics, items, loadItems, globalFlags, violationCounts, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings, cabFlagsCount, staffTimesFlagsCount, dressFlagsCount, lossByDateFlagsCount, expensesFlagsCount, customersFlagsCount, setCustomersFlagsCount, vendorsFlagsCount, setVendorsFlagsCount, personal, pickLossView, goToViolation, groups, role, username, showFlags, canManage, rolePermissions, paneOrder, setPaneOrder, paneLabels, setPaneLabels, paneGroups, setPaneGroups, paneHidden, setPaneHidden, combinedCashItems, canSeeTeam, canSeeUsers, canViewPortalAs, myStaffName, viewingName, routablePages, liveCountRecords, liveCountsItems, liveViewingCountRecords, liveSaleFlagList, pickLiveFlag, pickPL, goItemsMode, goCountMode, goLossSubView, renderLossesByDateTable, renderLossesByItemsTable, renderCostGteSpTable, renderSoldBelowCostTable } = h
  return (<><div className="relative flex-1 min-h-0 overflow-y-auto">
        {<HubScrollArea h={h} />}
        {addForm === 'item'    && outerTab === 'loss' && lossView === 'items'    && <div className="px-4"><NewItemForm    onSuccess={() => { setAddForm(null); loadItems() }} /></div>}
        {outerTab === 'loss' && lossView === 'pl' && (
          <TabErrorBoundary>
            <div className="flex-1 min-h-0 flex flex-col">
              {/* P&L's own small sub-nav -- the actual report, plus Loss by
                  Date/Loss by Items/Net Loss moved here from the Count tab
                  (see pickPL/plSubView) since they're a financial-loss
                  concern, not a counting one. Reuses the same
                  renderLossesByDateTable/renderLossesByItemsTable Count used
                  to call -- these two functions don't depend on anything
                  Sale-mode-specific, just liveCountRecords (fetched via
                  liveViewingCountRecords, which already covers this case).
                  Cost >= Selling Price/Sold Below Cost moved here from the
                  Sales tab's own violations row for the same reason -- both
                  are an actual per-sale loss rather than a data-hygiene gap
                  (see renderCostGteSpTable/renderSoldBelowCostTable). */}
              {plSubView === 'pl' ? <><PageToolbar grow={false} inlineClassName="flex justify-end px-2 py-1"><PageGuide page="pl" /></PageToolbar><ProfitLossTab /></> :
                plSubView === 'loss_by_date' ? renderLossesByDateTable() :
                plSubView === 'loss_by_items' ? renderLossesByItemsTable() :
                plSubView === 'net_loss' ? renderLossesByItemsTable(true) :
                plSubView === 'cost_gte_sp' ? renderCostGteSpTable() :
                renderSoldBelowCostTable()}
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'vendors' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2"><VendorsPage openAddSignal={vendorSignal} initialSearch={vendorSearchText} onFlagCountChange={setVendorsFlagsCount} /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'customers' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2">
              <CustomersPage initialSearch={customerSearchText} onFlagCountChange={setCustomersFlagsCount} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'counts' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2 space-y-2">
              <CountsTab items={liveCountsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch} violation={null}
                onFixRecords={(view) => { if (view === 'sales') jumpToLiveSaleTab('sales'); else if (view === 'bills') jumpToLiveSaleTab('bills') }}
                jumpToCountId={jumpToCountId} onJumpDone={() => setJumpToCountId(null)} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'flags' && showFlags && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-3 pb-24 pt-3">
              <p className="mb-1 text-lg font-bold text-[#14213D]">🚩 Flags</p>
              <FlagQuotaLine />
              <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-900">👔 Managers and owners only. Staff never see flags. Company law: the manager fixes at least 5 flags a day, starting with the negative stock. Tap a flag to open it where it is fixed.</p>
              {(() => {
                type Row = { label: string; n: number; go: () => void }
                const groups: { title: string; rows: Row[] }[] = [
                  { title: 'Live / Items', rows: [...liveSaleFlagList].sort((x, y) => (x.key === 'neg_soh' ? -1 : y.key === 'neg_soh' ? 1 : 0)).map(f => ({ label: f.key === 'neg_soh' ? '🔻 Negative Stock (start here)' : f.label, n: f.n, go: () => { pickLossView('items'); pickLiveFlag(f.value) } })) },
                  { title: 'Sales Log and receipts', rows: [
                    { label: 'No cash recorded', n: violationCounts['no_cash'] ?? 0, go: () => goItemsMode('log') }, { label: 'Missing days', n: violationCounts['missing_days'] ?? 0, go: () => goItemsMode('log') },
                    { label: 'Duplicate receipts', n: violationCounts['dup_receipts'] ?? 0, go: () => goItemsMode('log') }, { label: 'High walk-in share', n: violationCounts['high_wnw'] ?? 0, go: () => goItemsMode('log') } ] },
                  { title: 'Bills', rows: [
                    { label: 'No vendor', n: violationCounts['no_vendor'] ?? 0, go: () => goItemsMode('bills') }, { label: 'No items', n: violationCounts['no_items_bills'] ?? 0, go: () => goItemsMode('bills') },
                    { label: 'Total mismatch', n: violationCounts['bill_total_mismatch'] ?? 0, go: () => goItemsMode('bills') }, { label: 'No attachment', n: violationCounts['bill_no_attachment'] ?? 0, go: () => goItemsMode('bills') },
                    { label: 'No expense', n: violationCounts['bill_no_expense'] ?? 0, go: () => goItemsMode('bills') } ] },
                  { title: 'Cash at bank', rows: [{ label: 'CAB not checked', n: cabFlagsCount, go: () => pickLossView('cab') }] },
                  { title: 'Losses', rows: [{ label: 'Gains and cost above selling price', n: lossByDateFlagsCount, go: () => goLossSubView('loss_by_date') }] },
                  { title: 'Team', rows: [{ label: 'Missing staff times', n: staffTimesFlagsCount, go: () => pickLossView('teamTimes') }, { label: 'Dress code (shirt)', n: dressFlagsCount, go: () => pickLossView('staff_dress' as LossView) }] },
                  { title: 'Expenses, Customers and Vendors', rows: [{ label: 'Expenses', n: expensesFlagsCount, go: () => goItemsMode('expenses') }, { label: 'Customers (missing details)', n: customersFlagsCount, go: () => jumpToCustomersTab() }, { label: 'Vendors (missing details)', n: vendorsFlagsCount, go: () => pickLossView('vendors') }] },
                ]
                return <div className="space-y-3">{groups.map(g => {
                  const total = g.rows.reduce((a, r) => a + r.n, 0)
                  return (
                    <div key={g.title} className="rounded-2xl border border-gray-200 bg-white p-2">
                      <p className="mb-1 flex items-center gap-2 px-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{g.title}<span className={`rounded-full px-2 py-0.5 text-[10px] ${total > 0 ? 'bg-red-600 text-white' : 'bg-green-100 text-green-800'}`}>{total > 0 ? total : 'clear'}</span></p>
                      <div className="space-y-1">{g.rows.map(r => (
                        <button key={r.label} type="button" disabled={r.n === 0} onClick={r.go} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${r.n > 0 ? 'bg-red-50 font-semibold text-gray-900' : 'bg-gray-50 text-gray-400'}`}>
                          <span>{r.label}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${r.n > 0 ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{r.n}</span>
                        </button>))}</div>
                    </div>
                  )
                })}</div>
              })()}
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'item360' && (
          <TabErrorBoundary>
            <Item360Page />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'home' && (
          <TabErrorBoundary>
            <div className="px-4 pt-2"><TodayContent /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'dailySummary' && (
          <TabErrorBoundary>
            <DailySummaryTab />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'purchaseOrders' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2"><PurchaseOrdersPage /></div>
          </TabErrorBoundary>
        )}
        {/* Settings' own non-navigation row (see SettingsPane.tsx) -- now a
            real content destination like everything else in Settings,
            rather than an inline widget crammed into the narrow pane itself. */}
        {outerTab === 'loss' && lossView === 'settings' && (
          <TabErrorBoundary>
            <SettingsHome canEdit={isOwnerLevel(h.session?.user as never)}
              viewing={h.myStaffName ? { names: [h.myStaffName, ...STAFF_ROSTER.filter(n => n.toLowerCase() !== h.myStaffName!.toLowerCase())], current: h.viewingName, pick: h.pickViewing } : undefined}
              pages={[
                ...(h.canManage ? STAFF_ADMIN_TEAM_ITEMS.map(t => ({ icon: t.icon, label: t.label.replace('Private ', ''), detail: t.key === 'teamPayslips' ? 'Every staff member\'s pay' : 'Every staff member\'s bio and bank details', onClick: () => h.pickLossView(t.key) })) : []),
                ...(h.canSeeUsers || h.canManage ? [{ icon: '🔐', label: 'Users & Roles', detail: 'Logins and what each role may open', onClick: () => h.pickLossView('users' as never) }] : []),
                ...(h.canViewPortalAs ? [{ icon: '👁', label: 'View Portal As', detail: 'See the app as a staff member sees it', onClick: () => h.pickLossView('viewPortalAs') }] : []),
                ...(h.canManage ? [{ icon: '↕️', label: 'Reorder & Rename Lists', detail: 'The order and names of the sidebar lists', onClick: () => h.pickLossView('reorderLists') },
                  { icon: '⏱️', label: 'Activity Times', detail: 'How long each kind of work takes', onClick: () => h.pickLossView('activityDurations') }] : []),
                ...(isOwnerLevel(h.session?.user as never) ? [{ icon: '🔔', label: 'Push devices', detail: 'Which phones and computers get notifications', onClick: () => h.openEmbed('/notifications') }] : []),
                ...(h.canSeeCash && h.isOwnerOrJoe ? [{ icon: '🏷️', label: 'Barcode labels', detail: 'Print item barcode labels', onClick: () => h.openEmbed('/barcode-labels') }] : []),
              ]} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'viewPortalAs' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 max-w-sm space-y-3">
              <h1 className="text-lg font-bold text-gray-900">View Portal As</h1>
              <ViewPortalAsButton extraAllowed={canViewPortalAs} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'reorderLists' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 max-w-sm space-y-2">
              <ReorderListsPanel cashItems={combinedCashItems} manageItems={MANAGE_LIST_ITEMS} staffItems={STAFF_TEAM_ITEMS}
                paneOrder={paneOrder} setPaneOrder={setPaneOrder} paneLabels={paneLabels} setPaneLabels={setPaneLabels}
                paneGroups={paneGroups} setPaneGroups={setPaneGroups} paneHidden={paneHidden} setPaneHidden={setPaneHidden} />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'activityDurations' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 max-w-sm">
              <ActivityDurationsPanel />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && MANAGE_VIEW_KEYS.has(lossView) && (
          <TabErrorBoundary>
            <GronyManageContent view={lossView as ManageView}
              canManage={canManage} categoryIds={fixedCategoryIds}
              openerViolations={openerViolations}
              assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              onGoToViolation={goToViolation}
              onSelectCheckType={(key) => pickLossView(key)}
              missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
              onOpenStaff={() => pickLossView('teamTimes')}
              propertiesInitialTab={propertiesInitialTab} />
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && isStaffView(lossView) && (
          <TabErrorBoundary>
            {lossView.startsWith('staffMember_') ? (
              // Individual staff member personal page
              (() => {
                const staffName = lossView.substring('staffMember_'.length)
                return (
                  <StaffMemberPersonalTab
                    staffName={staffName} username={username} role={role}
                    canManage={canManage} staffRoster={STAFF_ROSTER}
                    routablePages={routablePages} categoryIds={fixedCategoryIds} />
                )
              })()
            ) : myStaffName ? (
              // key forces a full remount whenever the logged-in identity
              // changes (e.g. an admin switching "View as" between staff
              // without leaving this tab) -- a stale identity could
              // otherwise leak into TimesTab/PayslipsTab's own local
              // state across accounts.
              <>
                <StaffContent key={myStaffName} view={lossView as StaffView}
                  viewingName={viewingName} role={role} username={username}
                  canSeeTeam={canSeeTeam || lossView === 'teamTimes'} canSeeUsers={canSeeUsers} canSeeRoles={canManage} canManage={canManage}
                  staffRoster={STAFF_ROSTER} routablePages={routablePages} categoryIds={fixedCategoryIds}
                  openAddSignal={staffTimeSignal} />
              </>
            ) : (
              <p className="py-10 text-center text-gray-400 text-sm px-4">No staff profile is set up for your account.</p>
            )}
          </TabErrorBoundary>
        )}
        {outerTab === 'uk' && (
          <TabErrorBoundary><UKTab uk={uk} rolePermissions={rolePermissions} /></TabErrorBoundary>
        )}
        {outerTab === 'ch' && (
          <TabErrorBoundary><CHTab view={lossView as CHView} childData={ch} rolePermissions={rolePermissions} /></TabErrorBoundary>
        )}
        {outerTab === 'today' && addForm !== 'expense' && (
          <TabErrorBoundary>
            <div className="h-full overflow-y-auto px-4 space-y-2 pt-2">
              <MyAssignmentsSummary assignments={assignments} deadlines={deadlines} />
              <TodayContent />
            </div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'expenseOrders' && (
          <TabErrorBoundary>
            <div className="flex-1 overflow-y-auto min-h-0"><ExpenseOrdersPanel /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'cab' && <><PageToolbar grow={false} inlineClassName="flex justify-end px-2 py-1"><PageGuide page="cab" /></PageToolbar><CABTab openConfirmSignal={cabConfirmSignal} /></>}
        {/* Items pill selected -> ItemsTab's filtered fix view; otherwise the
            submenu's normal content (LossTab). Same swap pattern for
            Sales/Counts/Feed below -- each of those already knows how to
            render its own filtered view when handed a matching violation
            key (SalesTab/CountsTab), or via the kind prop (LossFeedTab). */}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'aliasWide' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2"><AliasWidePage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'serviceMatches' && (
          <TabErrorBoundary>
            <div className="px-4 pt-4 space-y-2"><ServiceMatchesPage /></div>
          </TabErrorBoundary>
        )}
        {outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'gmcPacks' && (
          <TabErrorBoundary>
            <GmcPacksPage />
          </TabErrorBoundary>
        )}
        {showAnalytics && outerTab === 'loss' && lossView === 'items' && itemsExtraView === 'none' && (
          <TabErrorBoundary>
            <div className="px-3 pt-3">
              <ItemsAnalyticsSection />
              <ViolationsAnalyticsSection />
            </div>
          </TabErrorBoundary>
        )}
          </div></>)
}
