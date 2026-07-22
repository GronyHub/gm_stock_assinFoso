'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Card, Pill, Recommendation, PIE_COLORS, monthLabel, fc, n } from './analyticsShared'

type SummaryData = {
  monthlyExpenses?: { month: string; total: string | number }[]
  expensesByCategory?: { category: string; total: string | number }[]
}

// Expenses charts, distributed off the old standalone Data tab -- shown
// inline above the Expenses submenu's own list. No violation category maps
// to Expenses, so no ViolationsMiniChart here.
export default function ExpensesAnalyticsSection() {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const monthlyExpenses = useMemo(() => (data?.monthlyExpenses ?? []).filter(r => r.month).map(r => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const totalExp = useMemo(() => monthlyExpenses.reduce((s, r) => s + r.total, 0), [monthlyExpenses])

  if (loading || !data) return null

  return (
    <div className="px-3 pt-3">
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
      <Recommendation>
        This total includes every category, including Salaries -- a monthly jump does not necessarily mean discretionary spending grew, check Expenses by Category below before reacting to a spike here.
      </Recommendation>
      <Card title="Expenses by Category">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={(data.expensesByCategory ?? []).map(r => ({ name: r.category, value: n(r.total) }))}
              dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fontSize: 9 }}>
              {(data.expensesByCategory ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(v)} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        If one slice dominates every month, it is a fixed cost (rent, salaries) and not worth chasing -- the categories worth investigating are the smaller, more variable ones that suddenly grow relative to their usual share.
      </Recommendation>
    </div>
  )
}
