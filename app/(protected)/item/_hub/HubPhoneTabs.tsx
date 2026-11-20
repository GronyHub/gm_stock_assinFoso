'use client'
import type { HubCtx } from './useHubState'

// Phone only (hidden from 640px wide): five places used most, along the bottom where a thumb reaches them.
// More opens the full grouped menu (Work, Records, Money, Reports, Admin) as an overlay (see HubMainRow).
export default function HubPhoneTabs({ h, moreOpen, onToggleMore, onNavigate }: { h: HubCtx; moreOpen: boolean; onToggleMore: () => void; onNavigate: () => void }) {
  const { lossView, pickLossView, pickSaleFilter, openShop, shop, goItemsMode, jumpToCustomersTab, modeActive, paneActive, lastSaleUndo, setLastSaleUndo, undoTap, isOwnerOrJoe, canSeeManage, canSeeTeam, canSeeCash } = h
  const manage = !!isOwnerOrJoe && !!(canSeeManage || canSeeTeam)
  const liveActive = !moreOpen && !!paneActive(modeActive('sale'))
  const goLive = () => { h.setShop(null); if (lossView !== 'items') pickLossView('items'); pickSaleFilter('noViolations') }
  // Five places: Home (the day at a glance), Waiting, the central + (a new sale on Live), Sales Log, More. The + is the most common action, so it is raised.
  // Customers is under More > Records.
  const tabs = [
    { key: 'waiting', icon: '⏳', label: 'Waiting', active: !moreOpen && !!shop && shop.tab === 'todo', go: () => openShop('todo') },
    { key: 'done', icon: '✔', label: 'Done', active: !moreOpen && !!shop && shop.tab === 'home', go: () => openShop('home') },
    { key: 'sale', icon: '+', label: 'Cash', active: liveActive, go: goLive },
    ...(manage ? [{ key: 'manage', icon: '🛠', label: 'Manage', active: !moreOpen && !!shop && !['dashboard', 'todo', 'home', 'analytics', 'record'].includes(shop.tab), go: () => openShop('manage') }] : []),
    ...(canSeeCash ? [{ key: 'analytics', icon: '📊', label: 'Analytics', active: !moreOpen && !!shop && shop.tab === 'analytics', go: () => openShop('analytics') }] : []),
  ]
  return (<>
    {lastSaleUndo && (
      <div className="fixed inset-x-2 bottom-20 z-40 flex items-center justify-between gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-semibold text-white shadow-lg sm:bottom-4 sm:left-auto sm:right-4 sm:w-72 print:hidden">
        <span className="min-w-0 truncate">Recorded: {lastSaleUndo.name}</span>
        <button type="button" onClick={() => { const id = lastSaleUndo.tapId; setLastSaleUndo(null); void undoTap(id) }}
          className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-bold text-gray-900">Undo</button>
      </div>
    )}
    <nav aria-label="Main tabs" className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-gray-300 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      {tabs.map(t => t.key === 'sale' ? (
        <button key={t.key} type="button" onClick={() => { t.go(); onNavigate() }} aria-label="Cash" aria-current={t.active ? 'page' : undefined}
          className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-end gap-0.5 pb-1 text-[11px] font-bold ${t.active ? 'text-green-700' : 'text-gray-700'}`}>
          {t.active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-green-600" aria-hidden="true" />}
          <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-3xl leading-none text-white shadow-lg" aria-hidden="true">+</span>
          <span>{t.label}</span>
        </button>
      ) : (
        <button key={t.key} type="button" data-more-toggle={t.key === 'more' ? '' : undefined}
          aria-current={t.active ? 'page' : undefined}
          onClick={() => { t.go(); if (t.key !== 'more') onNavigate() }}
          className={`relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${t.active ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>
          {t.active && <span className="absolute inset-x-3 top-0 h-[3px] rounded-b bg-blue-600" aria-hidden="true" />}
          <span className="text-lg leading-none" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  </>)
}
