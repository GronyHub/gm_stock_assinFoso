'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'
import { Card } from './analyticsShared'

type Tier = 'Critical' | 'High' | 'Watch'
type Row = { id: number; name: string; soh: number; days_unbought: number; neverBought: boolean; tier: Tier }

const TIER_COLOR: Record<Tier, string> = { Critical: '#ef4444', High: '#f97316', Watch: '#eab308' }

// Read-only chart for the "Goods: Longest Unbought" filter -- see
// item/page.tsx's Sale mode filter row and /api/analysis/least-purchased.
// Days since each good was last on a bill, longest first -- a good that's
// never been bought at all still gets a real day count (measured from its
// earliest sale/tap/count on record, see that route's own comment), so bar
// length and color both track a genuine number instead of every
// never-bought item tying at the same flat bar.
export default function LeastPurchasedChart() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(true)
  // TEMP diagnostic -- see the API route's own comment. Remove alongside it.
  const [debug, setDebug] = useState<any>(null)

  useEffect(() => {
    fetch('/api/analysis/least-purchased')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(Array.isArray(d?.items) ? d.items : []); setDebug(d?.debug ?? null); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const data = useMemo(() => (rows ?? []).map(r => ({
    name: `${r.name} (SOH: ${r.soh})`,
    value: r.days_unbought,
    tier: r.tier,
    barLabel: r.neverBought ? `Never bought · ${r.days_unbought}d` : `${r.days_unbought}d`,
  })), [rows])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading…</div>
  if (!rows || rows.length === 0) return (
    <div className="py-10 text-center text-gray-400 text-xs space-y-2">
      <p>No goods found.</p>
      {debug && (
        <div className="text-left max-w-xs mx-auto bg-gray-50 border border-gray-200 rounded p-2 text-[10px] leading-relaxed">
          <p>Goods total: {debug.totalGoodsRows}</p>
          <p>Goods with stock &gt; 0: {debug.withPositiveStock}</p>
          <p>...with stock &amp; a purchase/sale/count on record: {debug.withStockAndHistory}</p>
          {debug.sampleNoHistoryButStocked?.length > 0 && (
            <>
              <p className="mt-1">Stocked but no history at all, e.g.:</p>
              <ul className="list-disc list-inside">
                {debug.sampleNoHistoryButStocked.map((r: any) => <li key={r.id}>{r.name} (SOH: {r.soh})</li>)}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="px-3 pt-3">
      <Card title="Goods: Longest Unbought" subtitle="Days since last purchased from a vendor, longest first. Out-of-stock goods are left off. Not the same as Least Sales -- this is about restocking, not selling.">
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 70 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={160} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(_v: any, _n: any, p: any) => [p.payload.barLabel, '']} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => <Cell key={i} fill={TIER_COLOR[d.tier]} />)}
              <LabelList dataKey="barLabel" position="right" style={{ fontSize: 9, fill: '#374151' }} />
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
