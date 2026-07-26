'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { Card, Pill, Recommendation, CATEGORY_COLORS } from './analyticsShared'

type ViolationRow = { key: string; label: string; category: string; count: number }

// Moved here from the removed "Data" tab's "Violations" section -- shown
// as part of Items' Analytics since violation pills/fix flows already live
// primarily in that tab, even though the violations themselves span
// several categories (see CATEGORY_COLORS).
export default function ViolationsAnalyticsSection() {
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/violations')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setViolations(d.violations ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const sorted = useMemo(() => [...violations].sort((a, b) => b.count - a.count), [violations])
  const total = useMemo(() => violations.reduce((s, v) => s + v.count, 0), [violations])
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const v of violations) map.set(v.category, (map.get(v.category) ?? 0) + v.count)
    return Array.from(map.entries()).map(([category, count]) => ({ category, count }))
  }, [violations])

  if (loading) return <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        <Pill label="Total Violations" value={String(total)} color={total > 0 ? '#dc2626' : '#22c55e'} />
        <Pill label="Categories Affected" value={String(byCategory.filter(c => c.count > 0).length)} />
      </div>

      <Card title="Needs Attention — All Violations" subtitle="Live snapshot, same counts shown on each tab's Violations menu.">
        <ResponsiveContainer width="100%" height={Math.max(200, sorted.length * 26)}>
          <BarChart data={sorted.map(v => ({ name: v.label, count: v.count, category: v.category }))} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="count" radius={[0,4,4,0]}>
              {sorted.map((v, i) => <Cell key={i} fill={CATEGORY_COLORS[v.category] ?? '#64748b'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
            <span key={cat} className="flex items-center gap-1 text-[9px] text-gray-500">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ background: color }} />{cat}
            </span>
          ))}
        </div>
      </Card>
      <Recommendation>
        {total === 0
          ? 'No open violations right now -- nice work keeping the data clean.'
          : `Focus on "${sorted[0]?.label}" first (${sorted[0]?.count} outstanding) since it's the largest single category. Assign it to a specific staff member in Staff -> Assignments if it isn't already owned, so it doesn't just sit unresolved.`}
      </Recommendation>

      <Card title="Violations by Category" subtitle="Which part of the app has the most open issues.">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={byCategory.filter(c => c.count > 0)} dataKey="count" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={{ fontSize: 9 }}>
              {byCategory.filter(c => c.count > 0).map((c, i) => <Cell key={i} fill={CATEGORY_COLORS[c.category] ?? '#64748b'} />)}
            </Pie>
            <Tooltip wrapperStyle={{ fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 9 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Recommendation>
        A category that is consistently the largest slice, month after month, points to a process gap in that part of the app rather than a one-off oversight -- e.g. Counts dominating usually means the daily/15-day schedule itself is unrealistic for current staffing, not that staff are being careless.
      </Recommendation>
    </div>
  )
}
