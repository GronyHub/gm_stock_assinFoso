'use client'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import PresentStaffBar from '../_components/PresentStaffBar'
import { setPageToolbarEl } from '@/lib/pageToolbar'
import { TodayContent, MyDayClient, ShopTeamTimes, StaffMemberPersonalTab, STAFF_ROSTER, formatPrice, type ShopTab } from './hubShared'
import type { HubCtx } from './useHubState'
import HubFilterBar from './HubFilterBar'
import HubContentColumn from './HubContentColumn'

export default function HubStaffBarAndOverlays({ h }: { h: HubCtx }) {
  const { initialTab, outerTab, lossView, search, setLiveManageSection, manageSideOptions, fixedCategoryIds, activeStaff, items, waitingBy, embedRef, embedUrl, personal, setPersonal, barH, barRef, shop, setShop, openShop, openPersonal, navSlotEl, isDesktop, role, username, isOwnerOrJoe, canManage, canSeeManage, canSeeTeam, routablePages, liveTapsStatus, liveTodaySalesTotal, salesByStaff, pickItemsMode, renderSectionFlags, goItemsMode, renderTabSwitcher } = h
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
              <div ref={barRef}><PresentStaffBar activeStaff={personal?.name ?? null} shopActive={!!shop} waitingBy={waitingBy} onOpenShop={() => openShop('todo')} roster={activeStaff} salesTotal={liveTapsStatus === 'ok' ? `₵${formatPrice(liveTodaySalesTotal)}` : '₵…'}
                selfName={username} onOpenStaff={openPersonal} salesBy={salesByStaff} /></div>
            </>
          )}
          {outerTab === 'loss' && isDesktop && navSlotEl && createPortal(
            <div className="flex items-center gap-3">
              <div className="flex min-w-0 max-w-[55%] shrink items-center gap-3 overflow-x-auto">
              <PresentStaffBar activeStaff={personal?.name ?? null} shopActive={!!shop} waitingBy={waitingBy} onOpenShop={() => openShop('todo')} embedded roster={activeStaff} selfName={username} onOpenStaff={openPersonal} salesBy={salesByStaff} salesTotal={liveTapsStatus === 'ok' ? `₵${formatPrice(liveTodaySalesTotal)}` : '₵…'} />
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
                <div className="flex shrink-0 items-center gap-1 border-b border-gray-200 px-2 py-1.5">
                  <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                    {([['todo', '✅ Waiting for team'], ['home', '✔ Done'], ['laws', '📜 Laws'], ['times', '🕐 Times'], ...(isOwnerOrJoe && (canSeeManage || canSeeTeam) ? [['violations', '⚖ Penalty Points'], ['manage', '🛠 Manage'], ['tasks', '📣 Tasks & notices'], ['guide', '🧭 Owner Guide'], ['checks', '🩺 System check']] : [])] as [ShopTab, string][]).map(([k, label]) => (
                      <button key={k} type="button" onClick={() => setShop({ tab: k })} className={`shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${shop.tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShop(null)} className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">✕ Close</button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {shop.tab === 'todo' && <iframe key={'t' + (shop.src ?? '')} src={shop.src ?? '/todo'} title="Waiting for team" className="h-full w-full border-0" />}
                  {shop.tab === 'laws' && <iframe key={'l' + (shop.src ?? '')} src={shop.src ?? '/laws'} title="Company Laws" className="h-full w-full border-0" />}
                  {shop.tab === 'home' && <div className="px-2"><TodayContent /></div>}
                  {shop.tab === 'times' && <div className="p-2"><ShopTeamTimes username={username} role={role} canManage={isOwnerOrJoe} /></div>}
                  {shop.tab === 'violations' && <iframe key="v" src="/penalties" title="Penalty Points" className="h-full w-full border-0" />}
                  {shop.tab === 'tasks' && <iframe key="t" src="/handbook-announcements" title="Tasks and notices" className="h-full w-full border-0" />}
                  {shop.tab === 'guide' && <iframe key="g" src="/owner-guide" title="Owner Guide" className="h-full w-full border-0" />}
                  {shop.tab === 'checks' && <iframe key="k" src="/integrity" title="System check" className="h-full w-full border-0" />}
                  {shop.tab === 'manage' && (
                    <div className="space-y-1 p-3">
                      <p className="text-xs text-gray-500">Pick a section. It opens in the main area.</p>
                      {manageSideOptions().map(o => (
                        <button key={o.key} type="button" onClick={() => { setShop(null); setLiveManageSection(o.key); goItemsMode('manage') }} className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-semibold text-gray-900">
                          <span>{o.label}</span>{o.badge > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">{o.badge}</span>}
                        </button>))}
                      {canSeeManage && <button type="button" onClick={() => { setShop(null); goItemsMode('advert') }} className="flex w-full items-center rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-semibold text-gray-900">📣 Advert</button>}
                      {canSeeManage && <button type="button" onClick={() => { setShop(null); goItemsMode('gronyChecks') }} className="flex w-full items-center rounded-xl border border-gray-200 bg-white px-3 py-3 text-left text-sm font-semibold text-gray-900">✔ Shop checks</button>}
                    </div>)}
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
          {<HubFilterBar h={h} />}
          {/* ── Content ── */}
          <HubContentColumn h={h} />
        </div></>)
}
