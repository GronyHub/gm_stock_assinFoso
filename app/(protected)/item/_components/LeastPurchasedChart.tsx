'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card } from './analyticsShared'

type Tier = 'Critical' | 'High' | 'Watch'
type Row = { id: number; name: string; soh: number; days_unbought: number | null; tier: Tier }

const TIER_COLOR: Record<Tier, string> = { Critical: '#ef4444', High: '#f97316', Watch: '#eab308' }

// Read-only chart for the "Goods: Longest Unbought" filter -- see
// item/page.tsx's Sale mode filter row and /api/analysis/least-purchased.
// Days since each good was last on a bill, longest first; a good never
// bought at all (no bill on record) shows as "Never bought" and ranks
// above every specific day count rather than being given a fake number.
export default function LeastPurchasedChart() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/least-purchased')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(Array.isArray(d?.items) ? d.items : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Never-bought rows get a bar as long as the longest real day count shown
  // (or a flat fallback if every row is "never bought") -- long enough to
  // read as the worst case, without inventing a number that isn't real.
  const data = useMemo(() => {
    const list = rows ?? []
    const maxReal = Math.max(0, ...list.map(r => r.days_unbought ?? 0))
    const neverBoughtBar = maxReal > 0 ? maxReal : 1
    return list.map(r => ({
      name: `${r.name} (SOH: ${r.soh})`,
      value: r.days_unbought ?? neverBoughtBar,
      tier: r.tier,
      label: r.days_unbought === null ? 'Never bought' : `${r.days_unbought}d`,
    }))
  }, [rows])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading…</div>
  if (!rows || rows.length === 0) return <div className="py-10 text-center text-gray-400 text-xs">No goods found.</div>

  return (
    <div className="px-3 pt-3">
      <Card title="Goods: Longest Unbought" subtitle="Days since last purchased from a vendor, longest first. Not the same as Least Sales -- this is about restocking, not selling.">
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(_v: any, _n: any, p: any) => [p.payload.label, '']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => <Cell key={i} fill={TIER_COLOR[d.tier]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <p className="text-[10px] text-gray-400 px-1 flex flex-wrap gap-x-3 gap-y-0.5">
        <span><span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: TIER_COLOR.Critical }} />Critical</span>
        <span><span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: TIER_COLOR.High }} />High</span>
        <span><span className="inline-block w-2 h-2 rounded-sm align-middle mr-1" style={{ background: TIER_COLOR.Watch }} />Watch</span>
      </p>
    </div>
  )
}
