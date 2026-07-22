'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, Sparkline, TrendBadge, StalenessBadge, monthLabel, fc, n } from './analyticsShared'
import ViolationsMiniChart from './ViolationsMiniChart'

type DeadStockItem = {
  item_id: number; item_name: string; cf_group: string | null
  soh: number; stock_value: number; last_sale_date: string | null; days_since_sale: number | null
}

function DeadStockCard() {
  const [items, setItems] = useState<DeadStockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/analysis/dead-stock')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setItems(d.items ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.trim().toLowerCase()
    return items.filter(i => i.item_name.toLowerCase().includes(q) || (i.cf_group ?? '').toLowerCase().includes(q))
  }, [items, search])

  const stale90 = useMemo(() => items.filter(i => i.days_since_sale === null || i.days_since_sale >= 90), [items])
  const stuckValue = useMemo(() => stale90.reduce((s, i) => s + i.stock_value, 0), [stale90])

  return (
    <Card title="Slow-Moving Stock" subtitle="In stock, but no walk-in sale in a while -- sorted by longest unsold.">
      <div className="flex gap-2 flex-wrap mb-2">
        <Pill label="90+ Days / Never Sold" value={String(stale90.length)} color="#dc2626" />
        <Pill label="Value Tied Up" value={fc(stuckValue)} color="#dc2626" />
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item or group…"
        className="w-full text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400 mb-2" />
      {loading ? (
        <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No in-stock goods found.</p>
      ) : (
        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
          {filtered.map(i => (
            <div key={i.item_id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-800 truncate">{i.item_name}</p>
                <p className="text-[9px] text-gray-400 truncate">{i.cf_group ?? 'Ungrouped'} · SOH {i.soh} · {fc(i.stock_value)}</p>
              </div>
              <StalenessBadge days={i.days_since_sale} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

type ItemTrend = {
  item_id: number; item_name: string; cf_group: string | null; product_type: string
  revenue_series: number[]; qty_series: number[]
  total_revenue: number; total_qty: number
  pct_change: number; direction: 'up' | 'down' | 'flat'
}

function ItemTrendsCard() {
  const [months, setMonths] = useState<string[]>([])
  const [trends, setTrends] = useState<ItemTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'revenue' | 'change'>('revenue')

  useEffect(() => {
    fetch('/api/analysis/item-trends')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setMonths(d.months ?? []); setTrends(d.trends ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let list = trends
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(t => t.item_name.toLowerCase().includes(q) || (t.cf_group ?? '').toLowerCase().includes(q))
    }
    return [...list].sort((a, b) => sortBy === 'revenue'
      ? b.total_revenue - a.total_revenue
      : Math.abs(b.pct_change) - Math.abs(a.pct_change))
  }, [trends, search, sortBy])

  return (
    <>
    <Card title="Sales Trend — All Items" subtitle={`WIC revenue by month, ${monthLabel(months[0])} – ${monthLabel(months[months.length - 1])}.`}>
      <div className="flex items-center gap-1.5 mb-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search item or group…"
          className="min-w-0 flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
        <button onClick={() => setSortBy(s => s === 'revenue' ? 'change' : 'revenue')}
          className="shrink-0 text-[10px] font-semibold px-2 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
          Sort: {sortBy === 'revenue' ? 'Revenue' : '% Change'}
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-4 text-center">No items found.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100">
          {filtered.map(t => (
            <div key={t.item_id} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-gray-800 truncate">{t.item_name}</p>
                <p className="text-[9px] text-gray-400 truncate">{t.cf_group ?? 'Ungrouped'}</p>
              </div>
              <Sparkline data={t.revenue_series} color="#3b82f6" />
              <p className="text-xs font-bold text-gray-900 w-16 text-right shrink-0">{fc(t.total_revenue)}</p>
              <TrendBadge direction={t.direction} pct={t.pct_change} />
            </div>
          ))}
        </div>
      )}
    </Card>
      <Recommendation>
        Sort by % Change to spot items trending down before they become a problem, and items trending up that may need a bigger stock buffer. An item with a flat sparkline near ₵0 either just launched or has stalled, so check which before assuming it is fine.
      </Recommendation>
    </>
  )
}

type SummaryData = {
  topLossItems?: { item_name: string; total_loss: string | number }[]
  stockValueByGroup?: { cf_group: string; value: string | number }[]
  lowStockItems?: { item_name: string; soh: string | number }[]
}

// Items charts + Slow-Moving Stock + Items-category violations, distributed
// off the old standalone Data tab -- shown inline above the Items (Gd/Srv.)
// submenu's own pack-chain table, only on the base (non-violation-filtered)
// view.
export default function ItemsAnalyticsSection() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading || !data) return null

  return (
    <div className="px-3 pt-3">
      <ItemTrendsCard />
      <Card title="Top 10 Items by Cumulative Loss" subtitle="Counted qty short of what the ledger expected.">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topLossItems?.length ?? 0) * 30)}>
          <BarChart data={(data.topLossItems ?? []).map(r => ({ name: r.item_name, loss: n(r.total_loss) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="loss" fill="#dc2626" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        This is an all-time count-vs-ledger shortfall, not a monthly figure -- see the Feed submenu for the same ranking broken out by ₵ value, unit quantity, and month-over-month trend.
      </Recommendation>
      <Card title="Stock Value by Group" subtitle="SOH × cost price per category.">
        <ResponsiveContainer width="100%" height={Math.max(180, (data.stockValueByGroup?.length ?? 0) * 28)}>
          <BarChart data={(data.stockValueByGroup ?? []).map(r => ({ name: r.cf_group, value: n(r.value) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="value" fill="#22c55e" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        This is capital sitting on the shelf, at cost -- not revenue. A group with a large bar here but low sales in the Sales Trend list above is capital that could be freed up by reordering less of it.
      </Recommendation>
      <Card title={`Out of Stock (${data.lowStockItems?.length ?? 0})`} subtitle="SOH at or below zero.">
        {(!data.lowStockItems || data.lowStockItems.length === 0)
          ? <p className="text-xs text-gray-400 py-1">Nothing out of stock.</p>
          : <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {data.lowStockItems.map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-gray-700">{r.item_name}</span>
                  <span className="text-red-500 font-semibold">{n(r.soh)}</span>
                </div>
              ))}
            </div>
        }
      </Card>
      <Recommendation>
        A negative SOH usually means a count is overdue or a sale was logged against the wrong item, not that stock is literally below zero -- check the recent counts for that item before reordering to correct it.
      </Recommendation>
      <DeadStockCard />
      <Recommendation>
        Goods with no sale in 90+ days (or never sold at all) are tying up capital and shelf space with little demand. Consider a discount or bundle promotion to clear them, cut future reorder quantities, or discontinue items that stay stale for multiple review cycles.
      </Recommendation>
      <ViolationsMiniChart category="Items" />
    </div>
  )
}
