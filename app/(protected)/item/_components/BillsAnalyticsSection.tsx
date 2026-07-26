'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Pill, Recommendation, monthLabel, n, fc } from './analyticsShared'

// Moved here from the removed "Data" tab's "Bills" section.
export default function BillsAnalyticsSection() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analysis/summary')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const monthlyBillSpend = useMemo(() => (data?.monthlyBillSpend ?? []).filter((r: any) => r.month).map((r: any) => ({ month: monthLabel(r.month), total: n(r.total) })), [data])
  const totalBills = useMemo(() => monthlyBillSpend.reduce((s: number, r: any) => s + r.total, 0), [monthlyBillSpend])

  if (loading) return <div className="py-10 text-center text-gray-400 text-xs">Loading analytics…</div>
  if (!data)   return <div className="py-10 text-center text-gray-400 text-xs">Could not load analytics.</div>

  return (
    <div>
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
      <Recommendation>
        A spike in one month is usually a bulk restock, not a cost problem -- compare against Stock Value by Group under Items&apos; Analytics to see whether that spend actually turned into shelf stock or just cash out the door.
      </Recommendation>
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
      <Recommendation>
        Heavy reliance on one vendor is a supply-chain risk, not just a cost line -- if the top bar here is far ahead of the second, it is worth having at least one backup supplier lined up for that vendors goods.
      </Recommendation>
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
      <Recommendation>
        Cross-check this list against Goods with the Most Losses under the Loss tab&apos;s Analytics -- an item that is both expensive to restock and losing stock to shrinkage is the highest-priority fix in the whole shop.
      </Recommendation>
    </div>
  )
}
