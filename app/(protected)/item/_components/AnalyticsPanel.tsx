'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { usePolling } from '@/lib/usePolling'

const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
function monthLabel(k: string | null | undefined) {
  if (!k) return '—'
  const [y, m] = k.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}
function dayLabel(s: string | null | undefined) {
  if (!s) return '—'
  const d = new Date(s + 'T00:00:00')
  return `${d.getDate()} ${SHORT_MON[d.getMonth()]}`
}
function n(v: any) { const x = parseFloat(v); return isNaN(x) ? 0 : x }
function fc(v: number) { return `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 0 })}` }

const PIE_COLORS = ['#3b82f6','#a855f7','#22c55e','#f97316','#ef4444','#06b6d4','#eab308','#ec4899','#64748b','#84cc16']

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 mb-3">
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      {subtitle && <p className="text-[10px] text-gray-400 mb-1">{subtitle}</p>}
      {children}
    </div>
  )
}

function Pill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[100px]">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: color ?? '#111827' }}>{value}</p>
    </div>
  )
}

function Recommendation({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 flex gap-2">
      <span className="text-sm shrink-0">💡</span>
      <p className="text-[11px] text-amber-800 leading-snug">{children}</p>
    </div>
  )
}

// Plain SVG rather than recharts -- a trend list can render one of these per
// item (potentially hundreds), and a recharts instance per row is too heavy.
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 64, h = 24, pad = 3
  const max = Math.max(...data, 0.0001)
  const points = data.map((v, i) => {
    const x = pad + (data.length > 1 ? (i / (data.length - 1)) * (w - pad * 2) : 0)
    const y = h - pad - (v / max) * (h - pad * 2)
    return [x, y]
  })
  const path = points.map(p => p.join(',')).join(' ')
  const [lastX, lastY] = points[points.length - 1] ?? [pad, h - pad]
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <polyline points={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  )
}

function TrendBadge({ direction, pct }: { direction: 'up' | 'down' | 'flat'; pct: number }) {
  const cls = direction === 'up' ? 'text-green-700 bg-green-50' : direction === 'down' ? 'text-red-700 bg-red-50' : 'text-gray-500 bg-gray-100'
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '—'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cls}`}>
      {arrow} {Math.abs(pct).toFixed(0)}%
    </span>
  )
}

type DeadStockItem = {
  item_id: number; item_name: string; cf_group: string | null
  soh: number; stock_value: number; last_sale_date: string | null; days_since_sale: number | null
}

function StalenessBadge({ days }: { days: number | null }) {
  const cls = days === null || days >= 90 ? 'bg-red-50 text-red-700' : days >= 30 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${cls}`}>
      {days === null ? 'Never sold' : `${days}d`}
    </span>
  )
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
  )
}

type CashTrendRow = {
  day: string
  walkin_count: number; walkin_counted: number
  total_cash_counted: number; total_invoiced: number
  avg_discrepancy: number
}

// Recent-half vs prior-half average, same rule as the item-trend badges.
function splitTrend(series: number[]): { pct: number; direction: 'up' | 'down' | 'flat' } {
  const half = Math.floor(series.length / 2)
  const recent = series.slice(-half)
  const prior = series.slice(0, series.length - half)
  const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1)
  const priorAvg = prior.reduce((a, b) => a + b, 0) / (prior.length || 1)
  if (priorAvg === 0 && recentAvg === 0) return { pct: 0, direction: 'flat' }
  if (priorAvg === 0) return { pct: 100, direction: 'up' }
  const pct = ((recentAvg - priorAvg) / priorAvg) * 100
  return { pct: Math.round(pct * 10) / 10, direction: pct > 10 ? 'up' : pct < -10 ? 'down' : 'flat' }
}

function CashCountedTrendCard() {
  const [rows, setRows] = useState<CashTrendRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/cash-trends')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const daily = useMemo(() => rows.filter(r => r.day).map(r => ({
    day: dayLabel(r.day),
    cashCounted: n(r.total_cash_counted),
    invoiced: n(r.total_invoiced),
    compliance: r.walkin_count > 0 ? Math.round((n(r.walkin_counted) / n(r.walkin_count)) * 1000) / 10 : 0,
  })), [rows])

  const complianceTrend = useMemo(() => splitTrend(daily.map(d => d.compliance)), [daily])
  const latest = daily[daily.length - 1]

  if (loading) return <Card title="Cash Counted Trend"><p className="text-xs text-gray-400 py-4 text-center">Loading…</p></Card>
  if (!daily.length) return <Card title="Cash Counted Trend"><p className="text-xs text-gray-400 py-4 text-center">No walk-in receipts yet.</p></Card>

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Latest Cash Counted" value={latest ? fc(latest.cashCounted) : '—'} color="#3b82f6" />
        <Pill label="Latest Compliance" value={latest ? `${latest.compliance}%` : '—'} />
        <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[100px] flex items-center justify-between">
          <p className="text-[10px] text-gray-400">Compliance Trend</p>
          <TrendBadge direction={complianceTrend.direction} pct={complianceTrend.pct} />
        </div>
      </div>
      <Card title="Cash Counted Trend" subtitle="Total cash counted per day, last 30 days.">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={daily} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Line type="monotone" dataKey="cashCounted" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Cash Counted vs Invoiced" subtitle="Last 30 days.">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={daily} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cashCounted" name="Cash Counted" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Cash Count Compliance" subtitle="% of receipts with cash actually counted, per day.">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={daily} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} unit="%" />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => `${v}%`} />
            <Line type="monotone" dataKey="compliance" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </>
  )
}

type LossItem = { item_id: number; item_name: string; cf_group: string | null; lgQty: number; lgAmt: number }
type LossTrendData = {
  monthlyLoss: { month: string; qty: number; value: number }[]
  topByValue: LossItem[]
  topByQty: LossItem[]
  leastByValue: LossItem[]
  lossByGroup: { cf_group: string; value: number }[]
}

function LossSection() {
  const [data, setData] = useState<LossTrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/loss-trends')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const monthly = useMemo(() => (data?.monthlyLoss ?? []).map(r => ({ month: monthLabel(r.month), value: r.value, qty: r.qty })), [data])
  const lossTrend = useMemo(() => splitTrend(monthly.map(m => m.value)), [monthly])

  if (loading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
  if (!data) return <p className="text-xs text-gray-400 py-4 text-center">Could not load loss trends.</p>

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Months Tracked" value={String(monthly.length)} />
        <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[100px] flex items-center justify-between">
          <p className="text-[10px] text-gray-400">Loss Trend</p>
          <TrendBadge direction={lossTrend.direction} pct={lossTrend.pct} />
        </div>
      </div>

      <Card title="Losses Trend" subtitle="Total loss value (₵) per month, all goods combined.">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={monthly} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Line type="monotone" dataKey="value" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        {lossTrend.direction === 'up'
          ? `Loss has increased over the recent months (▲ ${Math.abs(lossTrend.pct)}%). Move to daily stock counts (instead of weekly) for the top-loss items below, and review staff handling/storage for the periods where loss jumped.`
          : lossTrend.direction === 'down'
            ? `Loss is trending down (▼ ${Math.abs(lossTrend.pct)}%). Whatever changed recently is working -- keep the current counting cadence and staff assignments in place.`
            : `Loss is roughly flat month to month. Keep the current counting frequency, but watch the top-loss items below -- a flat trend can still hide a persistent, uncorrected problem.`}
      </Recommendation>

      <Card title="Goods with the Most Losses (₵)" subtitle="Cumulative loss value, all-time.">
        <ResponsiveContainer width="100%" height={Math.max(160, data.topByValue.length * 30)}>
          <BarChart data={data.topByValue.map(r => ({ name: r.item_name, value: r.lgAmt }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="value" fill="#dc2626" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        These goods account for the largest share of shrinkage value. Prioritize daily counts and tighter storage/access control for them first -- fixing the top 2-3 here will have more impact than spreading effort evenly across every item.
      </Recommendation>

      <Card title="Items with the Most Losses (Units)" subtitle="Cumulative loss quantity, all-time.">
        <ResponsiveContainer width="100%" height={Math.max(160, data.topByQty.length * 30)}>
          <BarChart data={data.topByQty.map(r => ({ name: r.item_name, qty: r.lgQty }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="qty" fill="#f97316" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        High unit-loss usually points to a process issue -- spillage, portioning, or miscounting -- rather than theft. Review how these specific items are measured, packaged, or handled, especially if they're low-value but high-quantity.
      </Recommendation>

      <Card title="Items with the Least Losses" subtitle="Smallest net discrepancy among actively-tracked items.">
        <ResponsiveContainer width="100%" height={Math.max(160, data.leastByValue.length * 30)}>
          <BarChart data={data.leastByValue.map(r => ({ name: r.item_name, value: r.lgAmt }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="value" fill="#22c55e" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        These items are the best-controlled in the shop. Whatever counting routine, storage, or staff member handles them is worth copying onto the highest-loss items above.
      </Recommendation>

      <Card title="Loss by Group" subtitle="Cumulative loss value (₵) by item category.">
        <ResponsiveContainer width="100%" height={Math.max(180, data.lossByGroup.length * 28)}>
          <BarChart data={data.lossByGroup.map(r => ({ name: r.cf_group, value: r.value }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="value" fill="#a855f7" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        If one category dominates total loss, assign a single accountable staff member to own stock counts for that category specifically, rather than rotating counters across every group.
      </Recommendation>
    </>
  )
}

const SECTIONS = [
  { key: 'Items',    icon: '📉' },
  { key: 'Loss',     icon: '🔻' },
  { key: 'Sales',    icon: '💰' },
  { key: 'Bills',    icon: '🧾' },
  { key: 'Counts',   icon: '🔢' },
  { key: 'Expenses', icon: '💸' },
  { key: 'Cash',     icon: '🏦' },
] as const
type AnaSection = (typeof SECTIONS)[number]['key']

export default function AnalyticsPanel() {
  const [section, setSection] = useState<AnaSection>('Items')
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])
  usePolling(load, 30000)

  const monthlyRevenue = useMemo(() => (data?.monthlyRevenue ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), wic: n(r.wic), gmc: n(r.gmc), total: n(r.total) })), [data])
  const dailyRevenue30 = useMemo(() => (data?.dailyRevenue30 ?? []).filter((r: any) => r.date).map((r: any) => ({ date: dayLabel(r.date), total: n(r.total) })), [data])
  const cashDiscrepancy = useMemo(() => (data?.cashDiscrepancyTrend ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), avg: Math.round(n(r.avg_discrepancy) * 100) / 100 })), [data])
  const monthlyBillSpend = useMemo(() => (data?.monthlyBillSpend ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const monthlyExpenses = useMemo(() => (data?.monthlyExpenses ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const countsPerMonth = useMemo(() => (data?.countsPerMonth ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), count: n(r.count) })), [data])

  const totalRevenue = useMemo(() => monthlyRevenue.reduce((s: number, r: any) => s + r.total, 0), [monthlyRevenue])
  const totalBills   = useMemo(() => monthlyBillSpend.reduce((s: number, r: any) => s + r.total, 0), [monthlyBillSpend])
  const totalExp     = useMemo(() => monthlyExpenses.reduce((s: number, r: any) => s + r.total, 0), [monthlyExpenses])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  return (
    <div className="px-3 pt-3 pb-6">

      <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-3 px-3">
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition
              ${section === s.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            <span>{s.icon}</span>{s.key}
          </button>
        ))}
      </div>

      {section === 'Items' && <>
      <ItemTrendsCard />
      <Card title="Top 10 Items by Cumulative Loss" subtitle="Counted qty short of what the ledger expected.">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topLossItems?.length ?? 0) * 30)}>
          <BarChart data={(data.topLossItems ?? []).map((r: any) => ({ name: r.item_name, loss: n(r.total_loss) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="loss" fill="#dc2626" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Stock Value by Group" subtitle="SOH × cost price per category.">
        <ResponsiveContainer width="100%" height={Math.max(180, (data.stockValueByGroup?.length ?? 0) * 28)}>
          <BarChart data={(data.stockValueByGroup ?? []).map((r: any) => ({ name: r.cf_group, value: n(r.value) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="value" fill="#22c55e" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title={`Out of Stock (${data.lowStockItems?.length ?? 0})`} subtitle="SOH at or below zero.">
        {(!data.lowStockItems || data.lowStockItems.length === 0)
          ? <p className="text-xs text-gray-400 py-1">Nothing out of stock.</p>
          : <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
              {data.lowStockItems.map((r: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1 text-xs">
                  <span className="text-gray-700">{r.item_name}</span>
                  <span className="text-red-500 font-semibold">{n(r.soh)}</span>
                </div>
              ))}
            </div>
        }
      </Card>
      <DeadStockCard />
      <Recommendation>
        Goods with no sale in 90+ days (or never sold at all) are tying up capital and shelf space with little demand. Consider a discount or bundle promotion to clear them, cut future reorder quantities, or discontinue items that stay stale for multiple review cycles.
      </Recommendation>
      </>}

      {section === 'Loss' && <LossSection />}

      {section === 'Sales' && <>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Total Revenue" value={fc(totalRevenue)} color="#3b82f6" />
        <Pill label="Months" value={String(monthlyRevenue.length)} />
      </div>
      <Card title="Monthly Revenue — WIC vs GMC">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyRevenue} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="wic" name="WIC" stackId="a" fill="#3b82f6" />
            <Bar dataKey="gmc" name="GMC" stackId="a" fill="#a855f7" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Daily Revenue — Last 30 Days">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dailyRevenue30} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Top 10 Items by Revenue">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topItemsBySales?.length ?? 0) * 30)}>
          <BarChart data={(data.topItemsBySales ?? []).map((r: any) => ({ name: r.item_name, revenue: n(r.revenue) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </>}

      {section === 'Bills' && <>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Total Spend" value={fc(totalBills)} color="#f97316" />
      </div>
      <Card title="Monthly Bill Spend">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyBillSpend} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="total" fill="#f97316" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Top 10 Vendors by Spend">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topVendorsBySpend?.length ?? 0) * 30)}>
          <BarChart data={(data.topVendorsBySpend ?? []).map((r: any) => ({ name: r.vendor_name, total: n(r.total) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="total" fill="#f97316" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Top 10 Items by Bill Spend">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topItemsByBillSpend?.length ?? 0) * 30)}>
          <BarChart data={(data.topItemsByBillSpend ?? []).map((r: any) => ({ name: r.item_name, spend: n(r.spend) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="spend" fill="#dc2626" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </>}

      {section === 'Counts' && <>
      <Card title="Stock Counts per Month">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={countsPerMonth} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" fill="#6366f1" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Most Frequently Counted Items">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.mostCountedItems?.length ?? 0) * 30)}>
          <BarChart data={(data.mostCountedItems ?? []).map((r: any) => ({ name: r.item_name, count: n(r.times_counted) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" fill="#6366f1" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </>}

      {section === 'Expenses' && <>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Total Expenses" value={fc(totalExp)} color="#dc2626" />
      </div>
      <Card title="Monthly Expenses">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlyExpenses} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="total" fill="#dc2626" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Expenses by Category">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={(data.expensesByCategory ?? []).map((r: any) => ({ name: r.category, value: n(r.total) }))}
              dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 9 }}>
              {(data.expensesByCategory ?? []).map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      </>}

      {section === 'Cash' && <>
      <CashCountedTrendCard />
      <Card title="Cash Discrepancy Trend" subtitle="Avg (cash − invoice). Negative = shortage.">
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={cashDiscrepancy} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Line type="monotone" dataKey="avg" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      </>}
    </div>
  )
}
