'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { usePolling } from '@/lib/usePolling'
import { Card, Pill, Recommendation, TrendBadge, dayLabel, monthLabel, n, fc, splitTrend } from './analyticsShared'

type CashTrendRow = {
  day?: string; month?: string
  walkin_count: number; walkin_counted: number
  total_cash_counted: number; total_invoiced: number
  avg_discrepancy: number
}

function CashCountedTrendCard() {
  const [dailyRows, setDailyRows] = useState<CashTrendRow[]>([])
  const [monthlyRows, setMonthlyRows] = useState<CashTrendRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/cash-trends')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setDailyRows(Array.isArray(d.daily) ? d.daily : [])
        setMonthlyRows(Array.isArray(d.monthly) ? d.monthly : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const daily = useMemo(() => dailyRows.filter(r => r.day).map(r => ({
    day: dayLabel(r.day),
    cashCounted: n(r.total_cash_counted),
    invoiced: n(r.total_invoiced),
    compliance: r.walkin_count > 0 ? Math.round((n(r.walkin_counted) / n(r.walkin_count)) * 1000) / 10 : 0,
  })), [dailyRows])

  const monthly = useMemo(() => monthlyRows.filter(r => r.month).map(r => ({
    month: monthLabel(r.month),
    cashCounted: n(r.total_cash_counted),
    invoiced: n(r.total_invoiced),
  })), [monthlyRows])

  const complianceTrend = useMemo(() => splitTrend(daily.map(d => d.compliance)), [daily])
  const latest = daily[daily.length - 1]

  if (loading) return <Card title="Cash Counted Trend"><p className="text-xs text-gray-400 py-4 text-center">Loading…</p></Card>
  if (!daily.length && !monthly.length) return <Card title="Cash Counted Trend"><p className="text-xs text-gray-400 py-4 text-center">No walk-in receipts yet.</p></Card>

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
      <Recommendation>
        A sudden dip usually means a receipt is missing its cash count, not that less cash actually came in -- cross-check against the Cash Counted vs Invoiced chart below before assuming a real drop in sales.
      </Recommendation>
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
      <Recommendation>
        The gray (Invoiced) and blue (Cash Counted) lines should track closely. A persistent gap between them, not just a one-day blip, points to an ongoing under- or over-counting habit worth raising with whoever counts cash most often.
      </Recommendation>
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
      <Recommendation>
        Days below 100% mean at least one receipt went unreconciled. If this dips repeatedly on the same day of the week or under the same staff member, that is the actual pattern to fix, not a one-off reminder.
      </Recommendation>
      <Card title="Cash Counted Trend — All Time" subtitle="Monthly, since 6 Nov 2023.">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={monthly} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} interval={Math.max(0, Math.floor(monthly.length / 12))} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="invoiced" name="Invoiced" stroke="#94a3b8" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cashCounted" name="Cash Counted" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        Use this view for seasonality -- e.g. a slow month every year around the same time is normal and not worth chasing, but a sustained drop from the long-run average across several months is.
      </Recommendation>
    </>
  )
}

// Moved here from the removed "Data" tab's "Sales" and "Cash" sections --
// grouped together since both are entirely about sales_receipts (revenue
// and its own cash-counting reconciliation), and there was no dedicated
// "Cash" tab of its own to move that half into.
export default function SalesAnalyticsSection() {
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
  const totalRevenue = useMemo(() => monthlyRevenue.reduce((s: number, r: any) => s + r.total, 0), [monthlyRevenue])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  return (
    <div>
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
        Zero-revenue days that are not Sundays usually mean a receipt was not entered, not that the shop was actually closed -- cross-check against the Missing Sales Days violation before treating it as a slow day.
      </Recommendation>
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
      <Recommendation>
        These are your revenue anchors -- make sure they are never the ones showing up in Slow-Moving Stock or Out of Stock under Items&apos; own Analytics, since running out of a top earner costs more than running out of anything else.
      </Recommendation>

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
      <Recommendation>
        A consistent shortage (line below zero, month after month) is a different problem than one bad month -- the former points to a process or trust issue worth addressing directly, the latter is more likely a one-off counting mistake.
      </Recommendation>
    </div>
  )
}
