'use client'
import { useState, useEffect, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts'
import { usePolling } from '@/lib/usePolling'

type AnaSection = 'Items' | 'Sales' | 'Bills' | 'Counts' | 'Expenses'

const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
function monthLabel(k: string) {
  const [y, m] = k.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}
function dayLabel(s: string) {
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

export default function AnalyticsPanel({ section }: { section: AnaSection }) {
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

  const monthlyRevenue = useMemo(() => (data?.monthlyRevenue ?? []).map((r: any) => ({ month: monthLabel(r.month), wic: n(r.wic), gmc: n(r.gmc), total: n(r.total) })), [data])
  const dailyRevenue30 = useMemo(() => (data?.dailyRevenue30 ?? []).map((r: any) => ({ date: dayLabel(r.date), total: n(r.total) })), [data])
  const cashDiscrepancy = useMemo(() => (data?.cashDiscrepancyTrend ?? []).map((r: any) => ({ month: monthLabel(r.month), avg: Math.round(n(r.avg_discrepancy) * 100) / 100 })), [data])
  const monthlyBillSpend = useMemo(() => (data?.monthlyBillSpend ?? []).map((r: any) => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const monthlyExpenses = useMemo(() => (data?.monthlyExpenses ?? []).map((r: any) => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const countsPerMonth = useMemo(() => (data?.countsPerMonth ?? []).map((r: any) => ({ month: monthLabel(r.month), count: n(r.count) })), [data])

  const totalRevenue = useMemo(() => monthlyRevenue.reduce((s: number, r: any) => s + r.total, 0), [monthlyRevenue])
  const totalBills   = useMemo(() => monthlyBillSpend.reduce((s: number, r: any) => s + r.total, 0), [monthlyBillSpend])
  const totalExp     = useMemo(() => monthlyExpenses.reduce((s: number, r: any) => s + r.total, 0), [monthlyExpenses])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  if (section === 'Sales') return (
    <div className="px-3 pt-3 pb-6">
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
    </div>
  )

  if (section === 'Bills') return (
    <div className="px-3 pt-3 pb-6">
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
    </div>
  )

  if (section === 'Expenses') return (
    <div className="px-3 pt-3 pb-6">
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
    </div>
  )

  if (section === 'Items') return (
    <div className="px-3 pt-3 pb-6">
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
    </div>
  )

  // Counts
  return (
    <div className="px-3 pt-3 pb-6">
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
    </div>
  )
}
