'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, TrendBadge, monthLabel, fc, splitTrend } from './analyticsShared'

type LossItem = { item_id: number; item_name: string; cf_group: string | null; lgQty: number; lgAmt: number }
type LossTrendData = {
  monthlyLoss: { month: string; qty: number; value: number }[]
  topByValue: LossItem[]
  topByQty: LossItem[]
  leastByValue: LossItem[]
  lossByGroup: { cf_group: string; value: number }[]
}

// Loss trend charts, distributed off the old standalone Data tab -- shown
// inline above the Feed submenu's own loss/gain record list.
export default function LossAnalyticsSection() {
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

  if (loading) return <div className="px-3 pt-3"><p className="text-xs text-gray-400 py-4 text-center">Loading…</p></div>
  if (!data) return null

  return (
    <div className="px-3 pt-3">
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
        High unit-loss usually points to a process issue -- spillage, portioning, or miscounting -- rather than theft. Review how these specific items are measured, packaged, or handled, especially if they are low-value but high-quantity.
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
    </div>
  )
}
