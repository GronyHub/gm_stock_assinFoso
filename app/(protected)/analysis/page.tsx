'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { usePolling } from '@/lib/usePolling'

const SECTIONS = ['Sales', 'Bills', 'Expenses', 'Items', 'Counts'] as const
type Section = typeof SECTIONS[number]

const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
function monthLabel(monthKey: string): string {
  if (!monthKey) return ''
  const [y, m] = monthKey.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}
function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getDate()} ${SHORT_MON[d.getMonth()]}`
}
function n(v: any): number {
  const x = parseFloat(v)
  return isNaN(x) ? 0 : x
}
function fmtCurrency(v: number): string {
  return `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}

const PIE_COLORS = ['#3b82f6', '#a855f7', '#22c55e', '#f97316', '#ef4444', '#06b6d4', '#eab308', '#ec4899', '#64748b', '#84cc16']

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3">
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mb-1">{subtitle}</p>}
      {children}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 flex-1 min-w-[100px]">
      <p className="text-[10px] text-gray-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: color ?? '#111827' }}>{value}</p>
    </div>
  )
}

export default function AnalysisPage() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<Section>('Sales')

  function load() {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  usePolling(load, 15000)

  const monthlyRevenue = useMemo(() => (data?.monthlyRevenue ?? []).map((r: any) => ({
    month: monthLabel(r.month), wic: n(r.wic), gmc: n(r.gmc), total: n(r.total),
  })), [data])

  const dailyRevenue30 = useMemo(() => (data?.dailyRevenue30 ?? []).map((r: any) => ({
    date: dayLabel(r.date), total: n(r.total),
  })), [data])

  const cashDiscrepancyTrend = useMemo(() => (data?.cashDiscrepancyTrend ?? []).map((r: any) => ({
    month: monthLabel(r.month), avg: Math.round(n(r.avg_discrepancy) * 100) / 100,
  })), [data])

  const monthlyBillSpend = useMemo(() => (data?.monthlyBillSpend ?? []).map((r: any) => ({
    month: monthLabel(r.month), total: n(r.total),
  })), [data])

  const monthlyExpenses = useMemo(() => (data?.monthlyExpenses ?? []).map((r: any) => ({
    month: monthLabel(r.month), total: n(r.total),
  })), [data])

  const countsPerMonth = useMemo(() => (data?.countsPerMonth ?? []).map((r: any) => ({
    month: monthLabel(r.month), count: n(r.count),
  })), [data])

  const totalRevenue = useMemo(() => monthlyRevenue.reduce((s: number, r: any) => s + r.total, 0), [monthlyRevenue])
  const totalBillSpend = useMemo(() => monthlyBillSpend.reduce((s: number, r: any) => s + r.total, 0), [monthlyBillSpend])
  const totalExpenses = useMemo(() => monthlyExpenses.reduce((s: number, r: any) => s + r.total, 0), [monthlyExpenses])

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>
  if (!data) return <div className="py-10 text-center text-gray-400">Could not load analytics.</div>

  return (
    <div className="py-4 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Analysis</h1>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {SECTIONS.map(s => (
          <button key={s} onClick={() => setSection(s)}
            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition
              ${section === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      {section === 'Sales' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <StatPill label="Total Revenue (all time)" value={fmtCurrency(totalRevenue)} color="#3b82f6" />
            <StatPill label="Months Tracked" value={String(monthlyRevenue.length)} />
          </div>

          <Card title="Monthly Revenue — WIC vs GMC">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyRevenue} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="wic" name="WIC" stackId="a" fill="#3b82f6" />
                <Bar dataKey="gmc" name="GMC" stackId="a" fill="#a855f7" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Daily Revenue — Last 30 Days">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyRevenue30} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top 10 Items by Sales Revenue">
            <ResponsiveContainer width="100%" height={Math.max(160, (data.topItemsBySales?.length ?? 0) * 32)}>
              <BarChart data={(data.topItemsBySales ?? []).map((r: any) => ({ name: r.item_name, revenue: n(r.revenue) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Cash Discrepancy Trend" subtitle="Avg. (cash counted − invoice total) per month. Negative = shortage.">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={cashDiscrepancyTrend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Line type="monotone" dataKey="avg" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {section === 'Bills' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <StatPill label="Total Spend (all time)" value={fmtCurrency(totalBillSpend)} color="#f97316" />
          </div>

          <Card title="Monthly Bill Spend">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyBillSpend} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="total" fill="#f97316" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top 10 Vendors by Spend">
            <ResponsiveContainer width="100%" height={Math.max(160, (data.topVendorsBySpend?.length ?? 0) * 32)}>
              <BarChart data={(data.topVendorsBySpend ?? []).map((r: any) => ({ name: r.vendor_name, total: n(r.total) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="total" fill="#f97316" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top 10 Items by Bill Spend">
            <ResponsiveContainer width="100%" height={Math.max(160, (data.topItemsByBillSpend?.length ?? 0) * 32)}>
              <BarChart data={(data.topItemsByBillSpend ?? []).map((r: any) => ({ name: r.item_name, spend: n(r.spend) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="spend" fill="#dc2626" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {section === 'Expenses' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <StatPill label="Total Expenses (all time)" value={fmtCurrency(totalExpenses)} color="#dc2626" />
          </div>

          <Card title="Monthly Expenses">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyExpenses} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="total" fill="#dc2626" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Expenses by Category">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={(data.expensesByCategory ?? []).map((r: any) => ({ name: r.category, value: n(r.total) }))}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 10 }}>
                  {(data.expensesByCategory ?? []).map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {section === 'Items' && (
        <div className="space-y-4">
          <Card title="Top 10 Items by Cumulative Loss" subtitle="Counted quantity short of what the running ledger expected.">
            <ResponsiveContainer width="100%" height={Math.max(160, (data.topLossItems?.length ?? 0) * 32)}>
              <BarChart data={(data.topLossItems ?? []).map((r: any) => ({ name: r.item_name, loss: n(r.total_loss) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="loss" fill="#dc2626" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Stock Value by Group" subtitle="Current SOH × cost price, summed per category.">
            <ResponsiveContainer width="100%" height={Math.max(180, (data.stockValueByGroup?.length ?? 0) * 30)}>
              <BarChart data={(data.stockValueByGroup ?? []).map((r: any) => ({ name: r.cf_group, value: n(r.value) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} formatter={(v: any) => fmtCurrency(v)} />
                <Bar dataKey="value" fill="#22c55e" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title={`Out of Stock Items (${data.lowStockItems?.length ?? 0})`} subtitle="Current SOH at or below zero.">
            {(!data.lowStockItems || data.lowStockItems.length === 0) ? (
              <p className="text-xs text-gray-400 py-2">Nothing out of stock right now.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                {data.lowStockItems.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-gray-700">{r.item_name}</span>
                    <span className="text-red-500 font-semibold">{n(r.soh)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {section === 'Counts' && (
        <div className="space-y-4">
          <Card title="Stock Counts Submitted per Month" subtitle="Count-taking activity over time.">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={countsPerMonth} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Most Frequently Counted Items">
            <ResponsiveContainer width="100%" height={Math.max(160, (data.mostCountedItems?.length ?? 0) * 32)}>
              <BarChart data={(data.mostCountedItems ?? []).map((r: any) => ({ name: r.item_name, count: n(r.times_counted) }))}
                layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366f1" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}
    </div>
  )
}
