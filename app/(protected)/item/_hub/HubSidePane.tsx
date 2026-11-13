'use client'
import { Fragment } from 'react'
import { signOut } from 'next-auth/react'
import { isOwnerLevel } from '@/lib/roles'
import PaneDaily from '../_components/PaneDaily'
import { STAFF_TEAM_ITEMS } from '../_components/staffViewData'
import CareChildTiles from '../_components/CareChildTiles'
import { requestOpenChild } from '../_components/careUtils'
import { CH_ITEMS, CH_CHILD_PERSON } from '../_components/chViewData'
import { useUKData } from '../_components/ukViewData'
import { SidePaneContainer, SidePaneToggle, SidePaneButton } from '../_components/SidePane'
import SettingsPane from '../_components/SettingsPane'
import { applyPaneOrder } from '../_components/paneOrder'
import { GronyManageContent, StaffContent, STAFF_ROSTER, MANAGE_VIEW_KEYS, CASH_ITEMS, PANE_ACCENT, type LossView, type Item } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubSidePane({ h }: { h: HubCtx }) {
  const { outerTab, lossView, setLossView, search, settingsOpen, setSettingsOpen, liveMode, itemsPageMode, liveManageSection, plSubView, lossesOpen, setLossesOpen, analyticsOpen, setAnalyticsOpen, liveSaleViolationFilter, sidePaneHidden, jumpToCustomersTab, setGlobalSearchOpen, uk, ukAllSubmenus, ukGeneralSubmenus, ch, items, globalFlags, violationCounts, salesFlagsCount, itemsFlagsCount, billsFlagsCount, cabFlagsCount, staffTimesFlagsCount, dressFlagsCount, countsFlagsCount, lossByDateFlagsCount, expensesFlagsCount, customersFlagsCount, vendorsFlagsCount, taskCountFor, changeTab, myDayBadge, pendingJobsBadge, setEmbedUrl, personal, setPersonal, shop, setShop, openEmbed, openShop, openPersonal, pickLossView, pickCHView, pickViewing, cashDisplayMode, changeCashDisplayMode, session, username, isOwnerOrJoe, showFlags, fl, canManage, paneOrder, paneLabel, paneHidden, cashItemActive, cashItemClick, cashItemTaskScope, combinedCashItems, perm, canSeeCash, isCaretakerOnly, canSeePL, canSeeUsers, canViewPortalAs, canSeeUK, canSeeCaretake, canSeeCH, canSeeCHTab, canOpenSettings, canOpenUkSettings, myStaffName, viewingName, paneActive, embedActive, paneAccent, liveNetLossCount, liveAcpGteSpCount, salesByStaff, liveSaleFlagTotal, pickSaleFilter, pickPL, goItemsMode, goSaleFilter, modeActive, goLossSubView } = h
  return (<>{!sidePaneHidden && (
        <SidePaneContainer mode={cashDisplayMode} accent={paneAccent} onAnyClick={() => { setEmbedUrl(null); setPersonal(null); setShop(null) }}
            footer={<>
              <PaneDaily mode={cashDisplayMode}
                onDaily={() => setLossView('dailySummary')}
                dailyActive={paneActive(lossView === 'dailySummary')} />
              <SidePaneButton icon="🔍" label="Search" mode={cashDisplayMode} divider active={false} noNewTab keepEmbed onClick={() => setGlobalSearchOpen(true)} />
              {/* Biz/UK/C&H/Search all moved out of this footer -- they now
                  live as small icons at the bottom of the content area (the
                  right side) instead, see below. */}
            </>}>
            <SidePaneToggle selfActive={!!personal && personal.name.toLowerCase() === username.toLowerCase()} mode={cashDisplayMode} onChange={changeCashDisplayMode} label={session?.user?.name ?? username} username={username} sales={salesByStaff[username.toLowerCase()] ?? 0} />

            {(session?.user as { impersonating?: boolean } | undefined)?.impersonating && (
              <SidePaneButton icon="👁" label="Exit view" mode={cashDisplayMode} divider noNewTab active={false}
                onClick={() => { void fetch('/api/impersonate', { method: 'DELETE' }).finally(() => { window.location.href = '/item' }) }} />
            )}
            {/* One place for everything that is waiting. A person's own list is this page filtered to their name, so there is no second list to contradict it. The badge is how many things wait for the signed-in person. */}
            <SidePaneButton icon="✅" label="Waiting for team" mode={cashDisplayMode} active={shop?.tab === 'todo'} badge={myDayBadge} divider noNewTab onClick={() => openShop('todo')} />
            {/* Pending jobs: what customers have left with us. For every logged-in staff member. */}
            <SidePaneButton icon="🧾" label="Pending jobs" mode={cashDisplayMode} divider noNewTab active={embedActive('/pending-jobs')} badge={pendingJobsBadge} href="/pending-jobs" onClick={() => openEmbed('/pending-jobs')} />
            {/* One Shop button: the Daily Checklist, Company Laws, Home and (owner and manager) the Manage sections are its tabs. */}
            <SidePaneButton icon="🏬" label="Shop" mode={cashDisplayMode} active={!!shop} divider shared={isOwnerOrJoe} noNewTab onClick={() => openShop('todo')} />

            {/* Cash/Manage/Staff's own rows only make sense while actually
                on that tab -- UK and C&H are separate areas with no
                relationship to any of these, so the list is just empty
                (toggle + View/Sign out only) while on either of them. */}
            {outerTab === 'loss' && (<>
            {canSeeCash && (
            <div>
              {/* Home moved to the tab switcher itself (first tab, above
                  Sale/Log/Sales/Bills/Expenses) -- no longer needs a row
                  here too now that it's reachable from there. */}
              {/* The Items hub's former top tabs, each its own row. */}
              {/* Items and Live Sale are the same screen -- one row. Lands on
                  the 'items' view (the superset: it also has the columns
                  picker) in plain Live mode, clearing any filter. */}
              <SidePaneButton icon="🛒" label={paneLabel('items', 'Live')} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(modeActive('sale'))} badge={fl(itemsFlagsCount)}
                taskBadge={taskCountFor(cashItemTaskScope('items'))}
                onClick={() => { if (lossView !== 'items') pickLossView('items'); pickSaleFilter('noViolations') }} />
              <SidePaneButton icon="📈" label="Sales Log" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(modeActive('log'))} badge={fl(salesFlagsCount)} onClick={() => goItemsMode('log')} />
              <SidePaneButton icon="👥" label="Customers" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(lossView === 'customers')} badge={fl(customersFlagsCount)} onClick={() => jumpToCustomersTab()} />
              {/* Cust. Receipts and New Customer are tabs inside Customers (its own tab row), not sidebar rows. */}
              {applyPaneOrder(combinedCashItems, paneOrder.cash).filter(v => v.key !== 'items' && (v.key !== 'pl' || canSeePL) && !paneHidden[v.key]).map((v, i) => (
                <Fragment key={v.key}>
                  <SidePaneButton icon={v.icon} label={paneLabel(v.key, v.label)} mode={cashDisplayMode} shared={isOwnerOrJoe && v.key === 'counts'}
                    active={paneActive(cashItemActive(v.key))} divider
                    badge={!showFlags ? undefined : v.key === 'sales' ? (salesFlagsCount + billsFlagsCount + lossByDateFlagsCount)
                      // Expenses/Vendors/Customers all moved off their own
                      // CASH_ITEMS row onto the Items row's badge -- 'items'
                      // is the real, reachable entry point into the whole
                      // Sale/Log/Sales/Bills/Expenses tab switcher now (none
                      // of them has its own CASH_ITEMS row any more), so
                      // that's where their combined flag count needs to show.
                      : v.key === 'items' ? itemsFlagsCount
                      : v.key === 'cab' ? cabFlagsCount
                      // Own row now instead of folded into Sales' badge --
                      // see LossView's 'counts' comment.
                      : v.key === 'counts' ? countsFlagsCount
                      : undefined}
                    taskBadge={taskCountFor(cashItemTaskScope(v.key))}
                    onClick={() => cashItemClick(v.key)} />
                </Fragment>
              ))}
              {showFlags && <SidePaneButton icon="🚩" label="Flags" mode={cashDisplayMode} divider badge={liveSaleFlagTotal + salesFlagsCount + billsFlagsCount + cabFlagsCount + lossByDateFlagsCount + staffTimesFlagsCount + dressFlagsCount + expensesFlagsCount + customersFlagsCount + vendorsFlagsCount || undefined}
                active={paneActive(lossView === 'flags')} onClick={() => pickLossView('flags')} />}
              <SidePaneButton icon="🔎" label="Item 360" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(lossView === 'item360')} onClick={() => pickLossView('item360')} />
              <SidePaneButton icon="📉" label={lossesOpen ? 'Losses ▾' : 'Losses ▸'} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(lossView === 'pl' && plSubView !== 'pl')} badge={fl(lossByDateFlagsCount)}
                noNewTab onClick={() => setLossesOpen(o => !o)} />
              {lossesOpen && (<>
                <SidePaneButton icon="•" label="Loss by Date" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(lossView === 'pl' && plSubView === 'loss_by_date')} onClick={() => goLossSubView('loss_by_date')} />
                <SidePaneButton icon="•" label="Loss by Items" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(lossView === 'pl' && plSubView === 'loss_by_items')} onClick={() => goLossSubView('loss_by_items')} />
                {liveNetLossCount > 0 && (
                  <SidePaneButton icon="•" label={`Net Loss (${liveNetLossCount})`} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                    active={paneActive(lossView === 'pl' && plSubView === 'net_loss')} onClick={() => goLossSubView('net_loss')} />
                )}
                {liveAcpGteSpCount > 0 && (
                  <SidePaneButton icon="•" label={`Cost ≥ Selling Price (${liveAcpGteSpCount})`} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                    active={paneActive(lossView === 'pl' && plSubView === 'cost_gte_sp')} onClick={() => goLossSubView('cost_gte_sp')} />
                )}
                {(globalFlags?.costGteSell?.length ?? 0) > 0 && (
                  <SidePaneButton icon="•" label={`Sold Below Cost (${globalFlags?.costGteSell?.length ?? 0})`} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                    active={paneActive(lossView === 'pl' && plSubView === 'sold_below_cost')} onClick={() => goLossSubView('sold_below_cost')} />
                )}
              </>)}
              <SidePaneButton icon="📊" label={analyticsOpen ? 'Analytics ▾' : 'Analytics ▸'} mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                active={paneActive(itemsPageMode === 'sale' && ['leastSalesServices', 'leastSalesGoods', 'leastSalesGroups', 'leastPurchased'].includes(liveSaleViolationFilter))}
                noNewTab onClick={() => setAnalyticsOpen(o => !o)} />
              {analyticsOpen && (<>
                <SidePaneButton icon="•" label="Services: Least Sales" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesServices')}
                  onClick={() => goSaleFilter('leastSalesServices', { kind: 'least_sales_services' })} />
                <SidePaneButton icon="•" label="Goods: Least Sales" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesGoods')}
                  onClick={() => goSaleFilter('leastSalesGoods', { kind: 'least_sales_goods' })} />
                <SidePaneButton icon="•" label="Groups: Least Sales" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastSalesGroups')}
                  onClick={() => goSaleFilter('leastSalesGroups', { kind: 'least_sales_groups' })} />
                <SidePaneButton icon="•" label="Goods: Longest Unbought" mode={cashDisplayMode} divider shared={isOwnerOrJoe}
                  active={paneActive(itemsPageMode === 'sale' && liveSaleViolationFilter === 'leastPurchased')}
                  onClick={() => goSaleFilter('leastPurchased', { kind: 'least_purchased' })} />
              </>)}
              <SidePaneButton icon="📖" label="How To" mode={cashDisplayMode} divider shared={isOwnerOrJoe} active={embedActive('/how-to')}
                href="/how-to" onClick={() => openEmbed('/how-to')} />
            </div>
            )}

            {/* Manage/Team pane rows retired -- both folded into the "Manage"
                tab on the Items hub's own internal tab switcher (see
                liveMode === 'manage' above), same move Cash's
                Vendors/Customers/Purchase Orders/P&L/CAB rows already made.
                GronyManageContent/StaffContent are the same components,
                just driven by liveManageSection there instead of lossView
                here -- pickLossView(...) quick actions/search results and
                the permission-bounce guard above still target these
                MANAGE_VIEW_KEYS/STAFF_TEAM_ITEMS keys directly, so those and
                the lossView-driven render blocks lower in this file are
                left intact. */}

            {/* Payslips and Profile are about one person, so they are tabs on that person's own page (tap your photo at the top of this pane). */}
            {canSeeCash && isOwnerOrJoe && (
            <div className="mt-1 pt-1 border-t border-white/30">
              <SidePaneButton icon="🏷️" label="Barcode labels" mode={cashDisplayMode} divider active={embedActive('/barcode-labels')}
                href="/barcode-labels" onClick={() => openEmbed('/barcode-labels')} />
              {isOwnerOrJoe && (<>
              <SidePaneButton icon="📥" label="Bills" mode={cashDisplayMode} divider
                active={paneActive(modeActive('bills'))} badge={fl(billsFlagsCount)} onClick={() => goItemsMode('bills')} />
              <SidePaneButton icon="💸" label="Expenses" mode={cashDisplayMode} divider
                active={paneActive(modeActive('expenses'))} badge={fl(expensesFlagsCount)} onClick={() => goItemsMode('expenses')} />
              <SidePaneButton icon="📑" label="Purchase Orders" mode={cashDisplayMode} divider
                active={paneActive(lossView === 'purchaseOrders')} onClick={() => pickLossView('purchaseOrders')} />
              <SidePaneButton icon="🏭" label="Vendors" mode={cashDisplayMode} divider
                active={paneActive(lossView === 'vendors')} badge={fl(vendorsFlagsCount)} onClick={() => pickLossView('vendors')} />
              </>)}
              {canSeePL && isOwnerOrJoe && (
                <SidePaneButton icon="💰" label="P&L" mode={cashDisplayMode} divider
                  active={paneActive(lossView === 'pl' && plSubView === 'pl')} onClick={() => pickPL()} />
              )}
              {canSeePL && isOwnerOrJoe && (
                <SidePaneButton icon="🏦" label="CAB" mode={cashDisplayMode} divider
                  active={paneActive(lossView === 'cab')} badge={fl(cabFlagsCount)} onClick={() => pickLossView('cab')} />
              )}
            </div>
            )}

            </>)}

            {/* C&H's own rows -- a separate area with no relationship to
                Cash/Manage/Staff, so it gets its own (much shorter) list
                here instead of any of theirs. Fiifi/Kuukua/Ebo/Odoye (moved
                here from UK) get a nested "X's Submenus" list underneath
                once selected, exactly like UK's own person rows below --
                driven by the `ch` useUKData() instance instead of `uk`. */}
            {outerTab === 'ch' && (<>
              {(canSeeCH || canSeeCaretake || perm('care_log')) && (
                <CareChildTiles onOpen={name => { if (lossView !== 'ch_care_today') pickCHView('ch_care_today'); requestOpenChild(name) }} />
              )}
              {CH_ITEMS.filter(item => (canSeeCH || item.key.startsWith('ch_care_'))
                && (item.key !== 'ch_personal' || isOwnerOrJoe)
                && (!CH_CHILD_PERSON[item.key] || canSeeUK)).map((item, i) => (
                <div key={item.key}>
                  <SidePaneButton icon={item.icon} label={item.label} mode={cashDisplayMode} divider={i > 0}
                    active={paneActive(lossView === item.key)} onClick={() => pickCHView(item.key)} />
                  {CH_CHILD_PERSON[item.key] && lossView === item.key && (
                    <div className="mt-1 pt-1 border-t border-white/30">
                      {ch.submenus.map((s, j) => (
                        <SidePaneButton key={s.id} icon="📋" label={s.name} mode={cashDisplayMode} divider={j > 0}
                          active={paneActive(ch.selectedSubmenuId === s.id)} onClick={() => ch.pickSubmenu(s.id)} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>)}

            {/* UK's own rows -- every person's every submenu, flat, in one
                list (e.g. "Grony NVQ Level 3", "Grony Urgent", "Mina Level
                3") instead of a People list you click through to reveal a
                nested Submenus list. Each click still opens just that one
                submenu's own page on the right (via uk.pickPerson +
                uk.pickSubmenu, exactly as the old two-click version did) --
                only the pane's own navigation got flattened, not the
                content area. Submenu names/columns are still fixed from
                the UI's side (no self-service add/rename/delete). */}
            {outerTab === 'uk' && (<>
              {ukAllSubmenus.map((s, i) => (
                <SidePaneButton key={s.id} icon="📋" label={`${s.person} ${s.name}`} mode={cashDisplayMode} divider={i > 0}
                  active={paneActive(uk.selectedSubmenuId === s.id)}
                  taskBadge={taskCountFor(`${s.person} ${s.name}`)}
                  onClick={() => { uk.pickPerson(s.person as typeof uk.person); uk.pickSubmenu(s.id); setSettingsOpen(false) }} />
              ))}

              {ukGeneralSubmenus.length > 0 && (
                <div className="mt-1 pt-1 border-t border-white/30">
                  {ukGeneralSubmenus.map((s, i) => (
                    <SidePaneButton key={s.id} icon="📁" label={s.name} mode={cashDisplayMode} divider={i > 0}
                      active={paneActive(uk.selectedSubmenuId === s.id)}
                      taskBadge={taskCountFor(`General ${s.name}`)}
                      onClick={() => { uk.pickPerson('General' as typeof uk.person); uk.pickSubmenu(s.id); setSettingsOpen(false) }} />
                  ))}
                </div>
              )}
            </>)}

            {/* Settings (Viewing/Team/Users/View Portal As/Reorder & Rename
                Lists/Activity Times) used to open as a second pane
                alongside this one, toggled by a button here -- with the
                main pane's own row count down a lot (Manage/Team/P&L/CAB/
                Vendors/Customers/Purchase Orders all folded into tabs), a
                whole second pane for a handful of rows read as more
                navigation, not less. SettingsPane now just renders its own
                sections as more of this same scrollable list instead,
                always visible rather than behind a toggle -- see
                SettingsPane.tsx below. UK is the one exception: its own
                Settings (add a menu/add a column) replaces the *content*
                area, not a sidebar, so it keeps its own toggle button. */}
            <div className="mt-1 pt-1 border-t border-white/30">
              {canOpenUkSettings && (
                <SidePaneButton icon="⚙️" label="Settings" mode={cashDisplayMode} active={settingsOpen}
                  noNewTab onClick={() => setSettingsOpen(v => !v)} />
              )}
              {isOwnerLevel(session?.user as any) && (
                <SidePaneButton icon="🔔" label="Push devices" mode={cashDisplayMode} active={embedActive('/notifications')} divider
                  href="/notifications" onClick={() => openEmbed('/notifications')} />
              )}
              <SidePaneButton icon="🚪" label="Sign out" mode={cashDisplayMode} active={false} divider
                noNewTab onClick={() => { if (confirm('Sign out?')) signOut({ callbackUrl: '/login' }) }} />
            </div>
            {outerTab !== 'uk' && isOwnerOrJoe && canOpenSettings && (
              <SettingsPane mode={cashDisplayMode} activeView={lossView}
                viewingName={viewingName} myStaffName={myStaffName} staffRoster={STAFF_ROSTER}
                pickViewing={pickViewing} pickLossView={pickLossView}
                canSeeUsers={canSeeUsers}
                canViewPortalAs={canViewPortalAs} canManageRoles={canManage} canManage={canManage}
              />
            )}

            {/* Biz/UK/C&H navigation buttons at bottom of sidebar */}
            <div className="mt-1 pt-1 border-t border-white/30 flex flex-col gap-1">
              {!isCaretakerOnly && (canSeeUK || canSeeCHTab) && (
                <button onClick={() => changeTab('loss')} title="Biz"
                  style={{ color: PANE_ACCENT.loss }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'loss' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  💰 Biz
                </button>
              )}
              {canSeeUK && (
                <button onClick={() => changeTab('uk')} title="UK"
                  style={{ color: PANE_ACCENT.uk }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'uk' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  🇬🇧 UK
                </button>
              )}
              {canSeeCHTab && (
                <button onClick={() => changeTab('ch')} title="C&H"
                  style={{ color: PANE_ACCENT.ch }}
                  className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition
                    ${outerTab === 'ch' ? 'bg-white/10 border-2 border-current' : 'border-2 border-transparent text-white/40 hover:text-white/70'}`}>
                  🏢 C&H
                </button>
              )}
            </div>
        </SidePaneContainer>
        )}</>)
}
