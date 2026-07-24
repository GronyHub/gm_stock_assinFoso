'use client'
import { useState, useEffect } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

const SHORT_MON = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']
function monthLabel(k: string) {
  const [y, m] = k.split('-').map(Number)
  return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}`
}
function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return `${d.getUTCDate()} ${SHORT_MON[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}
function fc(v: number) {
  return `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
}

type Monthly = { month: string; cashCounted: number; expenses: number; bills: number; dailyLoss: number; profit: number }
type Daily = { date: string; cashCounted: number; bills: number; expenses: number; cashOut: number; dailyLoss: number; profit: number }
type Data = {
  totals: { cashCounted: number; expenses: number; bills: number; dailyLoss: number; profit: number }
  monthly: Monthly[]
  daily: Daily[]
}

const TONE_CLS = {
  blue:   'bg-blue-50 text-blue-700',
  orange: 'bg-orange-50 text-orange-600',
  red:    'bg-red-50 text-red-600',
  green:  'bg-green-50 text-green-600',
} as const

function StatCard({ label, value, tone }: { label: string; value: string; tone: keyof typeof TONE_CLS }) {
  return (
    <div className={`rounded-xl p-3 ${TONE_CLS[tone]}`}>
      <p className="text-[10px] font-semibold opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

export default function ProfitLossTab() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    fetch('/api/analysis/profit-loss').then(r => {
      if (r.status === 403) { setForbidden(true); setLoading(false); return null }
      return r.ok ? r.json() : null
    }).then(d => { if (d) setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>
  if (forbidden) return <div className="py-20 text-center text-gray-400 text-xs px-6">Only the owner or Joe can view Profit &amp; Loss.</div>
  if (!data) return <div className="py-20 text-center text-gray-400 text-xs">Failed to load Profit &amp; Loss.</div>

  const { totals, monthly, daily } = data
  const isProfit = totals.profit >= 0

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatCard label="Cash Counted" value={fc(totals.cashCounted)} tone="blue" />
        <StatCard label="Bills + Expenses" value={fc(totals.bills + totals.expenses)} tone="orange" />
        <StatCard label="Daily Loss" value={fc(totals.dailyLoss)} tone="red" />
        <StatCard label={isProfit ? 'Net Profit' : 'Net Loss'} value={fc(Math.abs(totals.profit))} tone={isProfit ? 'green' : 'red'} />
      </div>
      <p className="text-[11px] text-gray-400 -mt-2">Cash Counted − (Bills + Expenses + Daily Loss), all time.</p>

      <div>
        <p className="text-sm font-semibold text-gray-700 mb-1">Daily Profit &amp; Loss</p>
        <p className="text-[10px] text-gray-400 mb-2">CC − (Cash Out + Daily Loss), one row per day.</p>
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-bold border-b border-gray-200 whitespace-nowrap">Date</th>
                <th className="text-right px-3 py-2 font-bold border-b border-gray-200">CC</th>
                <th className="text-right px-3 py-2 font-bold border-b border-gray-200">Cash Out</th>
                <th className="text-right px-3 py-2 font-bold border-b border-gray-200">Daily Loss</th>
                <th className="text-right px-3 py-2 font-bold border-b border-gray-200">P/L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {daily.map((d, i) => {
                const dayProfit = d.profit >= 0
                return (
                  <tr key={d.date} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{dayLabel(d.date)}</td>
                    <td className="px-3 py-2 text-right text-blue-600">{fc(d.cashCounted)}</td>
                    <td className="px-3 py-2 text-right text-orange-600">{fc(d.cashOut)}</td>
                    <td className="px-3 py-2 text-right text-red-500">{d.dailyLoss > 0 ? fc(d.dailyLoss) : '—'}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${dayProfit ? 'text-green-600' : 'text-red-500'}`}>
                      {dayProfit ? '' : '-'}{fc(Math.abs(d.profit))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {daily.length === 0 && <p className="text-xs text-gray-400 text-center py-10">No data</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-sm font-semibold text-gray-700 mb-1">Monthly Profit &amp; Loss</p>
        <p className="text-[10px] text-gray-400 mb-2">Cash counted against expenses, bills, and daily loss, by month.</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={monthly.map(m => ({ ...m, month: monthLabel(m.month) }))} margin={{ left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: any) => fc(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="cashCounted" name="Cash Counted" fill="#3b82f6" radius={[3,3,0,0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[3,3,0,0]} />
            <Bar dataKey="bills" name="Bills" fill="#ef4444" radius={[3,3,0,0]} />
            <Bar dataKey="dailyLoss" name="Daily Loss" fill="#a855f7" radius={[3,3,0,0]} />
            <Line type="monotone" dataKey="profit" name="Profit / Loss" stroke="#16a34a" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
        <span className="text-sm shrink-0">💡</span>
        <p className="text-[11px] text-amber-800 leading-snug">
          Daily Loss is stock shrinkage valued at selling price (same figure as the Daily Loss feed and the Items list Loss Amount column) -- it does not account for unsold stock still sitting in inventory, so a day or month with heavy restocking can still look worse than it really is.
        </p>
      </div>
    </div>
  )
}
