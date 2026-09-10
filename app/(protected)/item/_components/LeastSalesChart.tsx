'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from './analyticsShared'

type Kind = 'services' | 'goods' | 'groups'
type QtyRow = { name: string; qty_sold: number }
type GoodsRow = { name: string; soh: number; days_unsold: number }

const META: Record<Kind, { title: string; subtitle: string; empty: string }> = {
  services: { title: 'Services with the Least Sales', subtitle: 'All-time units tapped/sold, lowest first.', empty: 'No services found.' },
  goods: { title: 'Goods with the Least Sales', subtitle: 'Days since last sold, most stale first. Out-of-stock goods are left off -- see Negative/Zero Stock instead.', empty: 'No in-stock goods with a sale or bill on record.' },
  groups: { title: 'Groups with the Least Sales', subtitle: 'All-time units sold, totalled per group, lowest first.', empty: 'No groups found.' },
}

// Read-only chart, one per liveSaleView kind (least_sales_services/goods/
// groups) -- see item/page.tsx's Sale mode filter row. All three read the
// same /api/analysis/least-sales payload (one cached query, sliced three
// ways server-side), just picking a different key off it. Goods uses a
// different metric from the other two (days unsold, not qty sold) -- see
// that route's own comment for why.
export default function LeastSalesChart({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<QtyRow[] | GoodsRow[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch('/api/analysis/least-sales')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(Array.isArray(d?.[kind]) ? d[kind] : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [kind])

  const isGoods = kind === 'goods'
  const data = useMemo(() => {
    if (isGoods) {
      return (rows as GoodsRow[] | null ?? []).map(r => ({ name: `${r.name} (SOH: ${r.soh})`, value: r.days_unsold }))
    }
    return (rows as QtyRow[] | null ?? []).map(r => ({ name: r.name, value: Math.round(r.qty_sold * 100) / 100 }))
  }, [rows, isGoods])
  const meta = META[kind]

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading…</div>
  if (!rows || rows.length === 0) return <div className="py-10 text-center text-gray-400 text-xs">{meta.empty}</div>

  return (
    <div className="px-3 pt-3">
      <Card title={meta.title} subtitle={meta.subtitle}>
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => isGoods ? [`${v} days unsold`, ''] : [`${v} sold`, 'Qty']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => <Cell key={i} fill={!isGoods && d.value === 0 ? '#ef4444' : '#3b82f6'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <p className="text-[10px] text-gray-400 px-1">
        {isGoods ? 'Stock on hand shown next to each name.' : 'Red bars have never sold at all.'}
      </p>
    </div>
  )
}
