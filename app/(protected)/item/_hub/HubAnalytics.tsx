'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ItemsAnalyticsSection, ViolationsAnalyticsSection, ExpensesAnalyticsSection, SalesDaysSection, BillsAnalyticsSection, LiveSaleAnalyticsSection, TabErrorBoundary } from './hubShared'
import type { HubCtx } from './useHubState'

const CountsAnalyticsSection = dynamic(() => import('../_components/CountsAnalyticsSection'), { ssr: false })

type Key = 'sales' | 'items' | 'sellers' | 'losses' | 'counts' | 'bills' | 'expenses'

// Every analytics view in the app on one page, one tab each. The reports that live inside another page (least sales, losses) are listed as tiles that open them.
export default function HubAnalytics({ h }: { h: HubCtx }) {
  const owner = !!h.isOwnerOrJoe
  const tabs: { key: Key; icon: string; label: string; show: boolean }[] = [
    { key: 'sales', icon: '📈', label: 'Sales', show: true },
    { key: 'items', icon: '📦', label: 'Items', show: true },
    { key: 'sellers', icon: '🏷️', label: 'Least sold', show: true },
    { key: 'losses', icon: '📉', label: 'Losses', show: true },
    { key: 'counts', icon: '🔢', label: 'Counts', show: true },
    { key: 'bills', icon: '📥', label: 'Bills', show: owner },
    { key: 'expenses', icon: '💸', label: 'Expenses', show: owner },
  ]
  const visible = tabs.filter(t => t.show)
  const [tab, setTab] = useState<Key>('sales')
  const leave = (fn: () => void) => () => { h.setShop(null); fn() }
  const Tile = ({ icon, label, note, onClick }: { icon: string; label: string; note?: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-left active:opacity-80">
      <span aria-hidden="true" className="text-xl">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] text-gray-900">{label}</span>{note && <span className="block text-[12px] text-gray-500">{note}</span>}</span>
      <span aria-hidden="true" className="text-gray-400">›</span>
    </button>
  )
  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Analytics" className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-200 px-2 py-1.5">
        {visible.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-semibold ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t.icon} {t.label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-28 pt-3">
        <TabErrorBoundary>
          {tab === 'sales' && <div className="space-y-4"><LiveSaleAnalyticsSection /><SalesDaysSection /></div>}
          {tab === 'items' && <div className="space-y-4"><ItemsAnalyticsSection /><ViolationsAnalyticsSection /></div>}
          {tab === 'sellers' && (
            <div className="space-y-2">
              <p className="text-[13px] text-gray-500">What sells least, and what has not been bought for longest. Each opens the item list filtered to it.</p>
              <Tile icon="🛠️" label="Services: least sales" onClick={leave(() => h.goSaleFilter('leastSalesServices', { kind: 'least_sales_services' }))} />
              <Tile icon="📦" label="Goods: least sales" onClick={leave(() => h.goSaleFilter('leastSalesGoods', { kind: 'least_sales_goods' }))} />
              <Tile icon="🗂️" label="Groups: least sales" onClick={leave(() => h.goSaleFilter('leastSalesGroups', { kind: 'least_sales_groups' }))} />
              <Tile icon="⏳" label="Goods: longest unbought" onClick={leave(() => h.goSaleFilter('leastPurchased', { kind: 'least_purchased' }))} />
            </div>
          )}
          {tab === 'losses' && (
            <div className="space-y-2">
              <p className="text-[13px] text-gray-500">Where stock and money are lost.</p>
              <Tile icon="📅" label="Loss by date" onClick={leave(() => h.goLossSubView('loss_by_date'))} />
              <Tile icon="📦" label="Loss by items" onClick={leave(() => h.goLossSubView('loss_by_items'))} />
              {h.liveNetLossCount > 0 && <Tile icon="🔻" label="Net loss" note={`${h.liveNetLossCount} to look at`} onClick={leave(() => h.goLossSubView('net_loss'))} />}
              {h.liveAcpGteSpCount > 0 && <Tile icon="⚠️" label="Cost at or above selling price" note={`${h.liveAcpGteSpCount} to look at`} onClick={leave(() => h.goLossSubView('cost_gte_sp'))} />}
            </div>
          )}
          {tab === 'counts' && <CountsAnalyticsSection />}
          {tab === 'bills' && owner && <BillsAnalyticsSection />}
          {tab === 'expenses' && owner && <ExpensesAnalyticsSection />}
        </TabErrorBoundary>
      </div>
    </div>
  )
}
