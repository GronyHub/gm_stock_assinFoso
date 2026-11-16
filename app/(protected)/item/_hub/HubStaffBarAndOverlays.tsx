'use client'
import HubHome, { HubTeamPanel } from './HubHome'
import HubStatusStrip from './HubStatusStrip'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import PresentStaffBar from '../_components/PresentStaffBar'
import { setPageToolbarEl } from '@/lib/pageToolbar'
import { TabErrorBoundary, GronyManageContent, StaffContent, MANAGE_VIEW_KEYS, TodayContent, ShopTeamTimes, StaffMemberPersonalTab, STAFF_ROSTER, formatPrice, type ShopTab } from './hubShared'
import type { HubCtx } from './useHubState'
import WaitingForTeam from '@/components/WaitingForTeam'
import ShopRota from '../_components/ShopRota'
import HubFilterBar from './HubFilterBar'
import HubContentColumn from './HubContentColumn'
import { STAFF_TEAM_ITEMS, type StaffView } from '../_components/staffViewData'
import { ADVERT_ITEMS, GRONY_CHECKS_ITEMS, type ManageView } from '../_components/manageViewData'

export default function HubStaffBarAndOverlays({ h }: { h: HubCtx }) {
  const { initialTab, outerTab, lossView, search, setLiveManageSection, manageSideOptions, fixedCategoryIds, activeStaff, items, waitingBy, embedRef, embedUrl, personal, setPersonal, barH, barRef, shop, setShop, openShop, openPersonal, navSlotEl, isDesktop, role, username, isOwnerOrJoe, canManage, canSeeManage, canSeeTeam, routablePages, liveTapsStatus, liveTodaySalesTotal, salesByStaff, pickItemsMode, renderSectionFlags, goItemsMode, renderTabSwitcher } = h
  const { canSeeUsers, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings, goToViolation, globalFlags, propertiesInitialTab, myStaffName, viewingName, staffTimeSignal } = h as any
  const mgr = !!isOwnerOrJoe && !!(canSeeManage || canSeeTeam)
  const inGroup = ['dashboard', 'todo', 'home'].includes(shop?.tab ?? '') || (!mgr && shop?.tab === 'laws')
  useEffect(() => { window.dispatchEvent(new CustomEvent('waiting-view', { detail: personal?.tab === 'waiting' || shop?.tab === 'todo' })) }, [personal, shop])
  return (<><div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
          {/* Staff time bar + tab switcher: on desktop these portal into
              Nav's own top strip (see lib/navSlot.ts) instead of rendering
              here, reclaiming the two rows they used to occupy so
              everything below starts higher up the page. Mobile is
              unchanged -- Nav is hidden entirely below the md breakpoint
              (nothing to portal into), so both render in place exactly as
              before. */}
          {outerTab === 'loss' && !isDesktop && h.sidePaneHidden && (
            <>
              <div ref={barRef}><PresentStaffBar activeStaff={personal?.name ?? null} shopActive={!!shop} waitingBy={waitingBy} onOpenShop={() => openShop('home')} roster={activeStaff} salesTotal={liveTapsStatus === 'ok' ? `₵${formatPrice(liveTodaySalesTotal)}` : '₵…'}
                selfName={username} onOpenStaff={openPersonal} salesBy={salesByStaff} /></div>
            </>
          )}
          {outerTab === 'loss' && isDesktop && navSlotEl && createPortal(
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 max-w-[55%] shrink items-center gap-3 overflow-x-auto">
              <PresentStaffBar activeStaff={personal?.name ?? null} shopActive={!!shop} waitingBy={waitingBy} onOpenShop={() => openShop('home')} embedded roster={activeStaff} selfName={username} onOpenStaff={openPersonal} salesBy={salesByStaff} salesTotal={liveTapsStatus === 'ok' ? `₵${formatPrice(liveTodaySalesTotal)}` : '₵…'} />
              </div>
              {/* The open page's own controls (filters, search, columns) land here -- see lib/pageToolbar.tsx.
                  Outside the scrolling staff row so their drop-down panels are not clipped. Empty for pages
                  that don't use it. */}
              <div ref={setPageToolbarEl} className="flex min-w-[16rem] max-h-8 flex-1 flex-nowrap items-center justify-end gap-1.5 overflow-x-auto overflow-y-hidden empty:hidden" />
            </div>,
            navSlotEl
          )}

          {(embedUrl || personal || shop) && (
            <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col bg-white" style={{ top: isDesktop ? 0 : barH }}>
              {shop ? (<>
                {/* Waiting and Done are full pages of their own (bottom bar), so they carry no tab row; the row is for the Manage pages. */}
                {!(inGroup || (shop.tab === 'laws' && !mgr)) && (
                <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1.5">
                  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {([...(inGroup ? [['todo', '⏳ Waiting'], ['home', '✔ Done'], ...(mgr ? [] : [['laws', '📜 Laws']])] : []), ...(inGroup ? [] : [...(mgr ? [['team', '👥 Team'], ['laws', '📜 Laws']] : []), ['times', '🕐 Times'], ...(isOwnerOrJoe ? [['rota', '🗓 Rota']] : [])]), ...(!inGroup && mgr ? [['penalties', '⚖ Penalty Points'], ...manageSideOptions().map(o => [`m:${o.key}`, o.label, o.badge] as const), ...(canSeeManage ? [...ADVERT_ITEMS.map(a => [`m:${a.key}`, `${a.icon} ${a.label}`]), ...GRONY_CHECKS_ITEMS.map(a => [`m:${a.key}`, `${a.icon} ${a.label}`])] : []), ['tasks', '📣 Tasks & notices'], ['guide', '🧭 Owner Guide']] : [])] as unknown as [ShopTab, string, number?][]).map(([k, label, badge]) => (
                      <button key={k} type="button" onClick={() => setShop({ tab: k })} className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${(shop.tab === 'manage' ? `m:${manageSideOptions()[0]?.key}` : shop.tab) === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}{badge ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">{badge}</span> : null}</button>
                    ))}
                  </div>
                </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {shop.tab === 'todo' && (shop.src && shop.src !== '/todo'
                    ? <iframe key={'t' + shop.src} src={shop.src} title="Waiting for team" className="h-full w-full border-0" />
                    : <div className="h-full overflow-y-auto px-2 pt-3"><WaitingForTeam canManage={!!isOwnerOrJoe} noPeople below={<HubHome h={h} />} /></div>)}
                  {shop.tab === 'laws' && <iframe key={'l' + (shop.src ?? '')} src={shop.src ?? '/laws'} title="Company Laws" className="h-full w-full border-0" />}
                  {shop.tab === 'home' && <div className="px-2"><TodayContent /></div>}
                  {shop.tab === 'team' && <HubTeamPanel h={h} />}
                  {shop.tab === 'rota' && isOwnerOrJoe && <div className="p-2"><ShopRota canManage /></div>}
                  {shop.tab === 'times' && <div className="p-2"><ShopTeamTimes username={username} role={role} canManage={isOwnerOrJoe} /></div>}
                  {shop.tab === 'penalties' && <iframe key="v" src="/penalties" title="Penalty Points" className="h-full w-full border-0" />}
                  {shop.tab === 'tasks' && <iframe key="t" src="/handbook-announcements" title="Tasks and notices" className="h-full w-full border-0" />}
                  {shop.tab === 'guide' && <iframe key="g" src="/owner-guide" title="Owner Guide" className="h-full w-full border-0" />}
                  {(shop.tab === 'manage' || shop.tab.startsWith('m:')) && (() => {
                    const key = shop.tab === 'manage' ? String(manageSideOptions()[0]?.key ?? '') : shop.tab.slice(2)
                    const mv = { canManage, categoryIds: fixedCategoryIds, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings, onGoToViolation: goToViolation, missingClosingReportsCount: globalFlags?.missingClosingReports?.length ?? 0, onOpenStaff: () => openShop('times'), propertiesInitialTab }
                    return (
                      <div className="p-2">
                        <TabErrorBoundary>
                          {(MANAGE_VIEW_KEYS.has(key as never) || key === 'advert' || key === 'grony_checks') && canSeeManage && (GRONY_CHECKS_ITEMS.some(a => a.key === key)
                            ? <GronyManageContent key={key} view="grony_checks" checksSub={key as ManageView} {...mv} />
                            : ADVERT_ITEMS.some(a => a.key === key)
                            ? <GronyManageContent key={key} view="advert" advertSub={key as ManageView} {...mv} />
                            : <GronyManageContent key={key} view={key as ManageView} {...mv} />)}
                          {canSeeTeam && STAFF_TEAM_ITEMS.some(t => t.key === key) && (myStaffName
                            ? <StaffContent key={key} view={key as StaffView} viewingName={viewingName} role={role} username={username} canSeeTeam={canSeeTeam} canSeeUsers={canSeeUsers} canSeeRoles={canManage} canManage={canManage} staffRoster={STAFF_ROSTER} routablePages={routablePages} categoryIds={fixedCategoryIds} openAddSignal={staffTimeSignal} />
                            : <p className="py-10 text-center text-sm text-gray-400">No staff profile is set up for your account.</p>)}
                        </TabErrorBoundary>
                      </div>)
                  })()}
                </div>
              </>) : personal ? (<>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <StaffMemberPersonalTab key={personal.name + personal.tab} onClose={() => setPersonal(null)} staffName={personal.name} initialTab={personal.tab as never} username={username} role={role} canManage={canManage} staffRoster={STAFF_ROSTER} routablePages={routablePages} categoryIds={fixedCategoryIds} />
                </div>
              </>) : (
                <iframe ref={embedRef} key={embedUrl} src={embedUrl ?? ''} title="Page" className="min-h-0 w-full flex-1 border-0" />
              )}
            </div>
          )}

          {renderSectionFlags()}

          {/* This row (and the staff bar/portal above) shows for Items
              (lossView 'items' -- the sidebar row), 'sales' (the same
              screen's default landing view), and now also 'pl'/'cab' --
              P&L and CAB are full-screen reports rather than a mode within
              the Items/Sales grid (see pickItemsMode/renderTabSwitcher
              above), but still belong to this same tab row so switching
              back to Sale/Log/etc. from either is one tap. Every other
              lossView (Vendors, Expenses, Opener, etc.) still has nothing
              to do with this switcher and doesn't show it. */}
          <HubStatusStrip h={h} />
          {<HubFilterBar h={h} />}
          {/* ── Content ── */}
          <HubContentColumn h={h} />
        </div></>)
}
