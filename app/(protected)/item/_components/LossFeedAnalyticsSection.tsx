'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, dayLabel, n, fc } from './analyticsShared'

// Backs the Loss by Date tab -- the same day-by-day loss/gain events
// LossFeedTab lists one row at a time, rolled up into a 30-day trend and
// the items actually driving it.
export default function LossFeedAnalyticsSection() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/loss-feed')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const dailyTrend = useMemo(() => (data?.dailyTrend30 ?? []).map((r: any) => ({
    day: dayLabel(r.date), loss: n(r.loss), gain: n(r.gain),
  })), [data])
  const topLossItems = useMemo(() => (data?.topLossItems30 ?? []).map((r: any) => ({
    name: r.item_name, amt: n(r.amt),
  })), [data])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Loss (30d)" value={fc(n(data.totalLoss30))} color="#ef4444" />
        <Pill label="Gain (30d)" value={fc(n(data.totalGain30))} color="#22c55e" />
        <Pill label="Loss Events" value={String(n(data.lossCount30))} />
      </div>
      <Card title="Daily Loss vs Gain — Last 30 Days" subtitle="₵ amount reconciled each day.">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={dailyTrend} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="loss" name="Loss" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gain" name="Gain" stroke="#22c55e" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        A gain spike isn't automatically good news -- it usually means an earlier count or sale for that item was wrong, not that stock appeared from nowhere. Check the item's own history before treating a gain day as a win.
      </Recommendation>
      <Card title="Top 10 Loss Items — Last 30 Days" subtitle="By ₵ amount lost.">
        <ResponsiveContainer width="100%" height={Math.max(160, topLossItems.length * 28)}>
          <BarChart data={topLossItems} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Bar dataKey="amt" fill="#ef4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        A repeat name on this list month after month is worth a closer look at the item itself (miscounted, mispriced, or genuinely walking off) -- a one-off appearance is more likely a single bad count.
      </Recommendation>
    </div>
  )
}
