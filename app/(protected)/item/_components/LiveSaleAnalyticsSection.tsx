'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, dayLabel, n } from './analyticsShared'

// Distinct from Sales' own analytics (which already covers revenue trends
// and top-by-revenue items, live_sale_taps included) -- this is the
// tap-specific breakdown that view doesn't have: who's tapping, when, and
// how reliably (undo rate), not just how much came in. Shared by both the
// Live and Log tabs since they're the same underlying tap data, just two
// different ways of looking at it.
export default function LiveSaleAnalyticsSection() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/live-sale')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const dailyTaps = useMemo(() => (data?.dailyTaps30 ?? []).map((r: any) => ({
    day: dayLabel(r.date), taps: n(r.taps), revenue: n(r.revenue),
  })), [data])
  const byStaff = useMemo(() => (data?.byStaff30 ?? []).map((r: any) => ({
    name: r.staff_name, taps: n(r.taps), revenue: n(r.revenue),
  })), [data])
  const byHour = useMemo(() => {
    const hours = new Map<number, number>()
    for (const r of data?.byHour30 ?? []) hours.set(n(r.hour), n(r.taps))
    return Array.from({ length: 24 }, (_, h) => ({
      hour: h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`,
      taps: hours.get(h) ?? 0,
    }))
  }, [data])
  const topItems = useMemo(() => (data?.topItemsByCount30 ?? []).map((r: any) => ({
    name: r.item_name, taps: n(r.taps),
  })), [data])
  const totalTaps = useMemo(() => dailyTaps.reduce((s: number, r: any) => s + r.taps, 0), [dailyTaps])
  const undoRate = useMemo(() => {
    const total = n(data?.undoStats?.total)
    const undone = n(data?.undoStats?.undone)
    return total > 0 ? Math.round((undone / total) * 1000) / 10 : 0
  }, [data])
  const busiestHour = useMemo(() => byHour.reduce((best: any, r: any) => (!best || r.taps > best.taps ? r : best), null), [byHour])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Taps (30d)" value={String(totalTaps)} color="#3b82f6" />
        <Pill label="Busiest Hour" value={busiestHour ? busiestHour.hour : '—'} />
        <Pill label="Undo Rate" value={`${undoRate}%`} color={undoRate > 5 ? '#ef4444' : undefined} />
      </div>
      <Card title="Daily Taps — Last 30 Days" subtitle="How many sales were tapped in, per day.">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={dailyTaps} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 9 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="taps" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Taps by Hour of Day" subtitle="Last 30 days -- when the shop is actually busy.">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={byHour} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="taps" fill="#3b82f6" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        Staffing and stock-check timing should line up with the busiest bars here, not with assumptions about the day -- a quiet-looking chart around midday but a spike late afternoon means counts/restocks are safer to schedule in the morning.
      </Recommendation>
      <Card title="Taps by Staff — Last 30 Days" subtitle="Who's tapping the most (by revenue).">
        <ResponsiveContainer width="100%" height={Math.max(140, byStaff.length * 28)}>
          <BarChart data={byStaff} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={80} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="taps" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Most-Tapped Items — Last 30 Days" subtitle="By tap count, not revenue -- your highest-traffic items.">
        <ResponsiveContainer width="100%" height={Math.max(160, topItems.length * 28)}>
          <BarChart data={topItems} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="taps" fill="#22c55e" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        A rising Undo Rate above isn't automatically a problem -- mis-taps happen -- but a rate that keeps climbing, or that's concentrated on one item/staff member, usually means the tap grid's layout or pricing for that item is confusing enough to fix.
      </Recommendation>
    </div>
  )
}
