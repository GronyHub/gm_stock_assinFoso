'use client'
import { useEffect, useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import BaseStatCard from '@/components/StatCard'

// The money side of the Sales Log: the bank strip (running balance, last confirmed, unconfirmed weeks) and the profit and loss summary (all-time cards and the month-by-month chart).
// This is what the P&L and CAB tabs showed at the top; it opens with the Sales Log's Analytics view, so the log itself stays light. Only the owner and Joe get the figures (the APIs say no to anyone else).
const SHORT_MON = ['Ja', 'Fe', 'Mr', 'Ap', 'My', 'Ju', 'Jl', 'Au', 'Se', 'Oc', 'No', 'De']
const monthLabel = (k: string) => { const [y, m] = k.split('-').map(Number); return `${SHORT_MON[m - 1]} ${String(y).slice(-2)}` }
const fc = (v: number) => `₵${Number(v).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`
const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const TONE = { blue: 'bg-blue-50 text-blue-700', orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-600', green: 'bg-green-50 text-green-600' } as const
const Card = ({ tone, ...p }: { label: string; value: string; sub?: string; tone: keyof typeof TONE }) => <BaseStatCard {...p} cls={TONE[tone]} />

type CabRow = { entry_date: string; daily_net?: string | number | null; running_cash_at_bank: string | number | null; cab_total: string | number | null; cab_bank: unknown; cab_momo: unknown; cab_physical: unknown }
type Pl = { totals: { cashCounted: number; expenses: number; bills: number; dailyLoss: number; profit: number }; monthly: { month: string; cashCounted: number; expenses: number; bills: number; dailyLoss: number; profit: number }[] }

export default function MoneySummary() {
  const [pl, setPl] = useState<Pl | null>(null)
  const [cab, setCab] = useState<CabRow[] | null>(null)
  const [unconfirmed, setUnconfirmed] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/analysis/profit-loss').then(r => (r.ok ? r.json() : null)).then(d => d && setPl(d)).catch(() => {})
    fetch('/api/cash-at-bank').then(r => (r.ok ? r.json() : null)).then(d => setCab(Array.isArray(d) ? d : null)).catch(() => {})
    fetch('/api/flags').then(r => (r.ok ? r.json() : null)).then(d => setUnconfirmed(Array.isArray(d?.uncheckedCab) ? d.uncheckedCab.length : null)).catch(() => {})
  }, [])
  if (!pl && !cab) return null
  const latest = cab?.[0]
  // a day counts as confirmed only when figures were entered for it (the stored total is 0 for a day nobody confirmed)
  const lastConfirmed = cab?.find(r => !(r.cab_bank == null && r.cab_momo == null && r.cab_physical == null) && r.cab_total != null)
  // The estimate: the last confirmed total plus the net movement since it (the all-time running balance has no opening balance and is about ₵317,000 too high).
  const lastIdx = cab ? cab.findIndex(r => !(r.cab_bank == null && r.cab_momo == null && r.cab_physical == null) && r.cab_total != null) : -1
  const estimate = cab && lastIdx >= 0 ? Number(cab[lastIdx].cab_total) + cab.slice(0, lastIdx).reduce((a, r) => a + (Number(r.daily_net) || 0), 0) : null
  const t = pl?.totals
  return (
    <div className="mb-3 space-y-2">
      {cab && cab.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          <Card label="Bank estimate" value={estimate != null ? fc(estimate) : '—'} sub={latest ? `last confirmed + movement to ${fmtDate(String(latest.entry_date).slice(0, 10))}` : undefined} tone="blue" />
          <Card label="Last confirmed" value={lastConfirmed ? fc(Number(lastConfirmed.cab_total)) : '—'} sub={lastConfirmed ? fmtDate(String(lastConfirmed.entry_date).slice(0, 10)) : 'None yet'} tone="green" />
          <Card label="Unconfirmed weeks" value={unconfirmed == null ? '…' : String(unconfirmed)} tone={unconfirmed && unconfirmed > 0 ? 'red' : 'green'} />
        </div>
      )}
      {t && pl && (<>
        <div className="grid grid-cols-2 gap-1.5">
          <Card label="Cash counted (all time)" value={fc(t.cashCounted)} tone="blue" />
          <Card label="Bills + expenses" value={fc(t.bills + t.expenses)} tone="orange" />
          <Card label="Daily loss" value={fc(t.dailyLoss)} tone="red" />
          <Card label={t.profit >= 0 ? 'Net profit' : 'Net loss'} value={fc(Math.abs(t.profit))} tone={t.profit >= 0 ? 'green' : 'red'} />
        </div>
        <p className="text-[12px] text-gray-400">Cash counted − (bills + expenses + daily loss), all time. Daily loss is stock shrinkage valued at selling price, so a month with heavy restocking can still look strong.</p>
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="mb-1 text-sm font-semibold text-gray-700">Profit and loss by month</p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={pl.monthly.map(m => ({ ...m, month: monthLabel(m.month) }))} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip wrapperStyle={{ fontSize: 11 }} formatter={(v: unknown) => fc(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="cashCounted" name="Cash counted" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[3, 3, 0, 0]} />
              <Bar dataKey="bills" name="Bills" fill="#ef4444" radius={[3, 3, 0, 0]} />
              <Bar dataKey="dailyLoss" name="Daily loss" fill="#a855f7" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="profit" name="Profit / loss" stroke="#16a34a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </>)}
    </div>
  )
}
