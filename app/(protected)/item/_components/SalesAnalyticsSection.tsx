'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, monthLabel, dayLabel, fc, n } from './analyticsShared'
import ViolationsMiniChart from './ViolationsMiniChart'

type SummaryData = {
  monthlyRevenue?: { month: string; wic: string | number; gmc: string | number; total: string | number }[]
  dailyRevenue30?: { date: string; total: string | number }[]
  topItemsBySales?: { item_name: string; revenue: string | number }[]
}

// Sales charts + Sales-category violations, distributed off the old
// standalone Data tab -- shown inline above the Gd/Srv. Sld (Sales)
// submenu's own receipt list, only on the base (non-violation-filtered) view.
export default function SalesAnalyticsSection() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const monthlyRevenue = useMemo(() => (data?.monthlyRevenue ?? []).filter(r => r.month).map(r => ({ month: monthLabel(r.month), wic: n(r.wic), gmc: n(r.gmc), total: n(r.total) })), [data])
  const dailyRevenue30 = useMemo(() => (data?.dailyRevenue30 ?? []).filter(r => r.date).map(r => ({ date: dayLabel(r.date), total: n(r.total) })), [data])
  const totalRevenue = useMemo(() => monthlyRevenue.reduce((s, r) => s + r.total, 0), [monthlyRevenue])

  if (loading || !data) return null

  return (
    <div className="px-3 pt-3">
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
      <Recommendation>
        GMC (purple) is internal use, not revenue -- it is here for context on how much stock goes to the shops own work versus paying customers (blue). A rising GMC share relative to WIC is worth a look if it is not matched by service sales elsewhere.
      </Recommendation>
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
      <Recommendation>
        Zero-revenue days that are not Sundays usually mean a receipt was not entered, not that the shop was actually closed -- cross-check against the Missing Sales Days violation below before treating it as a slow day.
      </Recommendation>
      <Card title="Top 10 Items by Revenue">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.topItemsBySales?.length ?? 0) * 30)}>
          <BarChart data={(data.topItemsBySales ?? []).map(r => ({ name: r.item_name, revenue: n(r.revenue) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        These are your revenue anchors -- make sure they are never the ones showing up in Slow-Moving Stock or Out of Stock under Gd/Srv., since running out of a top earner costs more than running out of anything else.
      </Recommendation>
      <ViolationsMiniChart category="Sales" />
    </div>
  )
}
