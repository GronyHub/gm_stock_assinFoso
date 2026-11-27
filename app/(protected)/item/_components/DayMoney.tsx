'use client'
import { useEffect, useState } from 'react'

// The day's money beside its sales: bills, expenses, loss and profit (Profit & Loss) and the bank balance with its confirmation (Cash at bank).
// Loaded a moment after the log so the log opens at the same speed; a person who may not see them (the API says no) gets no extra line.
export type DayFig = { cash: number; bills: number; expenses: number; loss: number; profit: number } | null
export type BankFig = { running: number | null; confirmed: number | null; deficit: number | null } | null
export type DayMoneyMap = Map<string, { pl: DayFig; bank: BankFig }>

let shared: { at: number; data: DayMoneyMap } | null = null
export function useDayMoney(): DayMoneyMap {
  const [m, setM] = useState<DayMoneyMap>(() => (shared && Date.now() - shared.at < 5 * 60 * 1000 ? shared.data : new Map()))
  useEffect(() => {
    if (shared && Date.now() - shared.at < 5 * 60 * 1000) return
    const t = setTimeout(() => {
      void (async () => {
        const [pl, cab] = await Promise.all([
          fetch('/api/analysis/profit-loss').then(r => (r.ok ? r.json() : null)).catch(() => null),
          fetch('/api/cash-at-bank').then(r => (r.ok ? r.json() : null)).catch(() => null),
        ])
        const out: DayMoneyMap = new Map()
        const num = (v: unknown) => (v == null || v === '' ? null : Number(v))
        for (const d of (pl?.daily ?? []) as { date: string; cashCounted: number; bills: number; expenses: number; dailyLoss: number; profit: number }[]) out.set(String(d.date).slice(0, 10), { pl: { cash: d.cashCounted, bills: d.bills, expenses: d.expenses, loss: d.dailyLoss, profit: d.profit }, bank: null })
        for (const c of (Array.isArray(cab) ? cab : []) as { entry_date: string; running_cash_at_bank: unknown; cab_total: unknown; cab_bank: unknown; cab_momo: unknown; cab_physical: unknown; deficit: unknown }[]) {
          const k = String(c.entry_date).slice(0, 10), cur = out.get(k) ?? { pl: null, bank: null }
          out.set(k, { ...cur, bank: { running: num(c.running_cash_at_bank), confirmed: c.cab_bank == null && c.cab_momo == null && c.cab_physical == null ? null : num(c.cab_total), deficit: num(c.deficit) } })
        }
        shared = { at: Date.now(), data: out }
        setM(out)
      })()
    }, 1200)
    return () => clearTimeout(t)
  }, [])
  return m
}

const c = (v: number) => `₵${Math.round(v).toLocaleString('en-GH')}`
export function DayMoneyLine({ f, className = '' }: { f: { pl: DayFig; bank: BankFig } | undefined; className?: string }) {
  const pl = f?.pl && (f.pl.cash || f.pl.bills || f.pl.expenses || f.pl.loss) ? f.pl : null   // a day with nothing yet has no profit to show
  if (!f || (!pl && !f.bank)) return null
  const off = f.bank?.deficit != null && Math.abs(f.bank.deficit) >= 1
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-0 text-[12px] font-bold leading-snug text-gray-700 ${className}`}>
      {pl && <><span title="Cash counted on all the day's receipts (WIC and GMC)">Cash in {c(pl.cash)}</span><span>Bills {pl.bills > 0 ? c(pl.bills) : '—'}</span><span>Expenses {pl.expenses > 0 ? c(pl.expenses) : '—'}</span>{pl.loss > 0 && <span className="text-red-600">Loss {c(pl.loss)}</span>}<span className={pl.profit >= 0 ? 'text-green-700' : 'text-red-600'}>P/L {pl.profit < 0 ? '-' : ''}{c(Math.abs(pl.profit))}</span></>}
      {f.bank && f.bank.running != null && <span className="text-indigo-800">Bank {c(f.bank.running)}</span>}
      {f.bank && f.bank.confirmed != null && <span className={off ? 'text-red-600' : 'text-green-700'}>✓ confirmed {c(f.bank.confirmed)}{off ? ` (${(f.bank.deficit as number) > 0 ? '+' : '-'}${c(Math.abs(f.bank.deficit as number))})` : ''}</span>}
    </div>
  )
}
