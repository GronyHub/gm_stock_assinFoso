'use client'
import type { HubCtx } from './useHubState'

// Phone only (hidden from 640px wide): five places used most, along the bottom where a thumb reaches them.
// More opens the full grouped menu (Work, Records, Money, Reports, Admin) as an overlay (see HubMainRow).
export default function HubPhoneTabs({ h, moreOpen, onToggleMore, onNavigate }: { h: HubCtx; moreOpen: boolean; onToggleMore: () => void; onNavigate: () => void }) {
  const { lossView, pickLossView, pickSaleFilter, openShop, shop, goItemsMode, jumpToCustomersTab, modeActive, paneActive } = h
  const tabs = [
    { key: 'todo', icon: '✅', label: 'Waiting', active: !moreOpen && !!shop && shop.tab === 'todo',
      go: () => openShop('todo') },
    { key: 'live', icon: '🛒', label: 'Live', active: !moreOpen && !!paneActive(modeActive('sale')),
      go: () => { if (lossView !== 'items') pickLossView('items'); pickSaleFilter('noViolations') } },
    { key: 'log', icon: '📈', label: 'Sales Log', active: !moreOpen && !!paneActive(modeActive('log')),
      go: () => goItemsMode('log') },
    { key: 'cust', icon: '👥', label: 'Customers', active: !moreOpen && !!paneActive(lossView === 'customers'),
      go: () => jumpToCustomersTab() },
    { key: 'more', icon: '☰', label: 'More', active: moreOpen, go: onToggleMore },
  ]
  return (
    <nav aria-label="Main tabs" className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-300 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      {tabs.map(t => (
        <button key={t.key} type="button" data-more-toggle={t.key === 'more' ? '' : undefined}
          aria-current={t.active ? 'page' : undefined}
          onClick={() => { t.go(); if (t.key !== 'more') onNavigate() }}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${t.active ? 'text-blue-700' : 'text-gray-600'}`}>
          <span className="text-lg leading-none" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
