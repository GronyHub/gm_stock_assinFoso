'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, Pill, Recommendation, CATEGORY_COLORS } from './analyticsShared'

type ViolationRow = { key: string; label: string; category: string; count: number }

// The old standalone Data tab had one "Needs Attention" chart covering every
// violation category at once -- split apart so each menu (Items, Sales,
// Counts, Cash, and Staff under Grony Manage) only shows the slice that's
// actually about it. Reuses the same /api/analysis/violations endpoint the
// old chart did, just filtered client-side to one category.
export default function ViolationsMiniChart({ category }: { category: string }) {
  const [violations, setViolations] = useState<ViolationRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/violations')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const all: ViolationRow[] = Array.isArray(d.violations) ? d.violations : []
        setViolations(all.filter(v => v.category === category))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [category])

  const sorted = useMemo(() => [...violations].sort((a, b) => b.count - a.count), [violations])
  const total = useMemo(() => violations.reduce((s, v) => s + v.count, 0), [violations])
  const color = CATEGORY_COLORS[category] ?? '#64748b'

  if (loading || violations.length === 0) return null

  return (
    <Card title={`Needs Attention — ${category}`} subtitle="Live snapshot, same counts shown on this menu's violation pills.">
      <div className="flex gap-2 flex-wrap mb-2">
        <Pill label="Total" value={String(total)} color={total > 0 ? '#dc2626' : '#22c55e'} />
      </div>
      <ResponsiveContainer width="100%" height={Math.max(120, sorted.length * 28)}>
        <BarChart data={sorted.map(v => ({ name: v.label, count: v.count }))} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
          <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
          <Tooltip wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="count" radius={[0,4,4,0]}>
            {sorted.map((v, i) => <Cell key={i} fill={color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <Recommendation>
        {total === 0
          ? 'No open violations in this category right now — nice work keeping the data clean.'
          : `Focus on "${sorted[0]?.label}" first (${sorted[0]?.count} outstanding) since it's the largest here.`}
      </Recommendation>
    </Card>
  )
}
