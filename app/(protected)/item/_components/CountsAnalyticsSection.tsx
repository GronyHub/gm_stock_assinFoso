'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Recommendation, monthLabel, n } from './analyticsShared'
import ViolationsMiniChart from './ViolationsMiniChart'

type SummaryData = {
  countsPerMonth?: { month: string; count: string | number }[]
  mostCountedItems?: { item_name: string; times_counted: string | number }[]
}

// Counts charts + Counts-category violations, distributed off the old
// standalone Data tab -- shown inline above the Counts submenu's own list,
// only on the base (non-violation-filtered) view.
export default function CountsAnalyticsSection() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const countsPerMonth = useMemo(() => (data?.countsPerMonth ?? []).filter(r => r.month).map(r => ({ month: monthLabel(r.month), count: n(r.count) })), [data])

  if (loading || !data) return null

  return (
    <div className="px-3 pt-3">
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
      <Recommendation>
        A month with noticeably fewer counts than usual is the leading indicator for a spike in loss the following month -- if this dips, expect (and look out for) the Losses Trend under the Feed submenu to follow.
      </Recommendation>
      <Card title="Most Frequently Counted Items">
        <ResponsiveContainer width="100%" height={Math.max(160, (data.mostCountedItems?.length ?? 0) * 30)}>
          <BarChart data={(data.mostCountedItems ?? []).map(r => ({ name: r.item_name, count: n(r.times_counted) }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" fill="#6366f1" radius={[0,4,4,0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        These are usually the Daily Count items by design, so a high number here is expected, not a red flag. Watch instead for items that are NOT on this list but should be -- high-value goods counted rarely are the ones most likely to develop unnoticed loss.
      </Recommendation>
      <ViolationsMiniChart category="Counts" />
    </div>
  )
}
