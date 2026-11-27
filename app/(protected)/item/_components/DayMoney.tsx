'use client'
import { useEffect, useState } from 'react'

// The day's money inside the Sales Log: bills, expenses, loss and profit (Profit & Loss), the bank balance (Cash at bank) and, for the owner and Joe, the bank confirmation:
// a "Confirm bank" form that opens right under the day, and a week line above each week. Loaded a moment after the log so the log opens at the same speed;
// a person who may not see the figures (the APIs say no) gets nothing extra.
export type DayFig = { cash: number; bills: number; expenses: number; loss: number; profit: number } | null
export type Bank = { running: number | null; net: number; gIn: number; debtors: number; gOut: number; total: number | null; parts: { bank: number; momo: number; physical: number } | null; deficit: number | null; verify: { ok: boolean; expected: number; diff: number } | null }
export type Day = { pl: DayFig; bank: Bank | null }
export type Week = { start: string; net: number; endBalance: number | null; endDate: string; confirmed: { date: string; total: number; deficit: number | null } | null }
type Data = { days: Map<string, Day>; weeks: Map<string, Week>; newestBankDay: string | null }
const EMPTY: Data = { days: new Map(), weeks: new Map(), newestBankDay: null }

const num = (v: unknown) => (v == null || v === '' ? null : Number(v))
const addDays = (d: string, n: number) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10)
export const weekStartOf = (d: string) => { const dow = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7; return addDays(d, -dow) }
const c = (v: number) => `₵${Math.round(v).toLocaleString('en-GH')}`
const c2 = (v: number) => `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`
const shortDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

let store: { at: number; data: Data } | null = null
const listeners = new Set<(d: Data) => void>()
async function loadAll(): Promise<void> {
  const [pl, cab] = await Promise.all([
    fetch('/api/analysis/profit-loss').then(r => (r.ok ? r.json() : null)).catch(() => null),
    fetch('/api/cash-at-bank').then(r => (r.ok ? r.json() : null)).catch(() => null),
  ])
  const days = new Map<string, Day>(), weeks = new Map<string, Week>()
  for (const d of (pl?.daily ?? []) as { date: string; cashCounted: number; bills: number; expenses: number; dailyLoss: number; profit: number }[]) days.set(String(d.date).slice(0, 10), { pl: { cash: d.cashCounted, bills: d.bills, expenses: d.expenses, loss: d.dailyLoss, profit: d.profit }, bank: null })
  type R = { entry_date: string; running_cash_at_bank: unknown; daily_net: unknown; grony_personal_cash_in: unknown; debtors_cash_in: unknown; grony_personal_expenses: unknown; cab_total: unknown; cab_bank: unknown; cab_momo: unknown; cab_physical: unknown; deficit: unknown }
  const rows = (Array.isArray(cab) ? cab : []) as R[]
  const asc = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)))
  // each confirmation is checked against the one before it plus the net movement since then
  // The bank estimate for a day is the last confirmed total plus the net movement since it (nothing before the first confirmation). The all-time running balance has no opening
  // balance and misses money that left the shop, so it is about ₵317,000 above the real bank; it is not shown.
  let prevTotal: number | null = null, netSince = 0
  const verify = new Map<string, { ok: boolean; expected: number; diff: number }>()
  const est = new Map<string, number | null>()
  for (const r of asc) {
    const k = String(r.entry_date).slice(0, 10)
    netSince = parseFloat((netSince + (Number(r.daily_net) || 0)).toFixed(4))
    if (!(r.cab_bank == null && r.cab_momo == null && r.cab_physical == null) && r.cab_total != null) {
      const total = Number(r.cab_total)
      if (prevTotal != null) { const expected = parseFloat((prevTotal + netSince).toFixed(2)), diff = parseFloat((total - expected).toFixed(2)); verify.set(k, { ok: Math.abs(diff) < 0.01, expected, diff }) }
      prevTotal = total; netSince = 0
      est.set(k, total)
    } else est.set(k, prevTotal == null ? null : parseFloat((prevTotal + netSince).toFixed(2)))
  }
  for (const r of rows) {
    const k = String(r.entry_date).slice(0, 10), cur = days.get(k) ?? { pl: null, bank: null }
    const confirmed = !(r.cab_bank == null && r.cab_momo == null && r.cab_physical == null) && r.cab_total != null
    days.set(k, { ...cur, bank: { running: est.get(k) ?? null, net: Number(r.daily_net) || 0, gIn: Number(r.grony_personal_cash_in) || 0, debtors: Number(r.debtors_cash_in) || 0, gOut: Number(r.grony_personal_expenses) || 0, total: confirmed ? Number(r.cab_total) : null, parts: confirmed ? { bank: Number(r.cab_bank ?? 0), momo: Number(r.cab_momo ?? 0), physical: Number(r.cab_physical ?? 0) } : null, deficit: confirmed ? (verify.get(k)?.diff ?? null) : null, verify: verify.get(k) ?? null } })
    const ws = weekStartOf(k), w = weeks.get(ws) ?? { start: ws, net: 0, endBalance: null, endDate: '', confirmed: null }
    w.net += Number(r.daily_net) || 0
    if (k > w.endDate) { w.endDate = k; w.endBalance = est.get(k) ?? null }
    if (confirmed && !w.confirmed) w.confirmed = { date: k, total: Number(r.cab_total), deficit: verify.get(k)?.diff ?? null }
    weeks.set(ws, w)
  }
  const data: Data = { days, weeks, newestBankDay: rows[0] ? String(rows[0].entry_date).slice(0, 10) : null }
  store = { at: Date.now(), data }
  listeners.forEach(l => l(data))
}
export function useDayMoney(): Data {
  const [d, setD] = useState<Data>(() => (store && Date.now() - store.at < 5 * 60 * 1000 ? store.data : EMPTY))
  useEffect(() => {
    listeners.add(setD)
    let t: ReturnType<typeof setTimeout> | null = null
    if (!(store && Date.now() - store.at < 5 * 60 * 1000)) t = setTimeout(() => { void loadAll() }, 1200)
    return () => { listeners.delete(setD); if (t) clearTimeout(t) }
  }, [])
  return d
}

// Opens the confirm form under a day (the newest day that has bank figures when no day is given).
export function openBankConfirm(date?: string) {
  const d = date ?? store?.data.newestBankDay
  if (d) window.dispatchEvent(new CustomEvent('bank-confirm-open', { detail: { date: d } }))
}
// An item for the Add menu: only when there are bank figures to confirm (owner and Joe).
export function ConfirmBankMenuItem({ onPick }: { onPick: () => void }) {
  const d = useDayMoney()
  if (!d.newestBankDay) return null
  return <button type="button" className="block w-full border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50" onClick={() => { onPick(); openBankConfirm() }}>Confirm bank</button>
}

const inp = 'w-full rounded-lg border border-gray-300 bg-white p-2 text-[16px] text-gray-900'
function ConfirmForm({ date, bank, onDone }: { date: string; bank: Bank; onDone: () => void }) {
  const [b, setB] = useState(bank.parts ? String(bank.parts.bank) : ''), [m, setM] = useState(bank.parts ? String(bank.parts.momo) : ''), [p, setP] = useState(bank.parts ? String(bank.parts.physical) : '')
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const total = (Number(b) || 0) + (Number(m) || 0) + (Number(p) || 0), filled = b !== '' && m !== '' && p !== ''
  const expected = bank.verify?.expected ?? (bank.total == null ? bank.running : null)
  const diff = expected != null ? total - expected : null
  async function save() {
    if (!filled) { setErr('Fill in bank, MoMo and physical (0 if none).'); return }
    setBusy(true); setErr('')
    const r = await fetch('/api/cash-at-bank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entry_date: date, cab_bank: Number(b), cab_momo: Number(m), cab_physical: Number(p) }) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setBusy(false); setErr(j.error ?? 'Could not save.'); return }
    await loadAll(); setBusy(false); onDone()
  }
  return (
    <div className="mt-1.5 space-y-2 rounded-xl border border-green-300 bg-white p-2.5">
      <p className="text-[13px] font-bold text-gray-900">Confirm the bank for {shortDate(date)}{expected != null ? <span className="font-semibold text-gray-500"> · expected {c(expected)} (last confirmation plus the movement since)</span> : null}</p>
      <div className="grid grid-cols-3 gap-2">
        {([['Bank', b, setB], ['MoMo', m, setM], ['Physical', p, setP]] as const).map(([label, v, set]) => (
          <label key={label} className="text-[11px] font-bold uppercase text-gray-500">{label}<input type="number" inputMode="decimal" value={v} onChange={e => set(e.target.value)} className={inp} placeholder="0" /></label>
        ))}
      </div>
      <p className="text-[13px] font-semibold text-gray-800">Total {c2(total)}{filled && diff != null ? <span className={Math.abs(diff) < 1 ? 'ml-2 text-green-700' : 'ml-2 text-red-600'}>{Math.abs(diff) < 1 ? '✓ matches' : `${diff > 0 ? '+' : '-'}${c2(Math.abs(diff))} from expected`}</span> : null}</p>
      {err && <p className="text-[13px] text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="min-h-[44px] flex-1 rounded-xl bg-green-600 text-[15px] font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save confirmation'}</button>
        <button type="button" onClick={onDone} className="min-h-[44px] flex-1 rounded-xl bg-gray-100 text-[15px] font-bold text-gray-700">Cancel</button>
      </div>
    </div>
  )
}

// The line under a day's header: the day's money, the bank balance and the confirmation (a tap on "confirmed" shows the breakdown, with Edit; "Confirm bank" opens the form right here).
export function DayMoney({ date, className = '' }: { date: string; className?: string }) {
  const { days } = useDayMoney()
  const [open, setOpen] = useState<'form' | 'view' | null>(null)
  const f = days.get(date)
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.date === date) { setOpen('form'); setTimeout(() => document.getElementById(`day-money-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60) } }
    window.addEventListener('bank-confirm-open', h); return () => window.removeEventListener('bank-confirm-open', h)
  }, [date])
  const pl = f?.pl && (f.pl.cash || f.pl.bills || f.pl.expenses || f.pl.loss) ? f.pl : null
  const bank = f?.bank ?? null
  if (!pl && !bank) return null
  const off = bank?.deficit != null && Math.abs(bank.deficit) >= 1
  return (
    <div id={`day-money-${date}`} className={className}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-[12px] font-bold leading-snug text-gray-700">
        {pl && <><span title="Cash counted on the day's walk-in receipt">Cash in {c(pl.cash)}</span><span>Bills {pl.bills > 0 ? c(pl.bills) : '—'}</span><span>Expenses {pl.expenses > 0 ? c(pl.expenses) : '—'}</span>{pl.loss > 0 && <span className="text-red-600">Loss {c(pl.loss)}</span>}<span className={pl.profit >= 0 ? 'text-green-700' : 'text-red-600'}>P/L {pl.profit < 0 ? '-' : ''}{c(Math.abs(pl.profit))}</span></>}
        {bank && bank.gIn > 0 && <span className="text-emerald-700" title="Grony's own cash paid in to the shop">Grony in {c(bank.gIn)}</span>}
        {bank && bank.debtors > 0 && <span className="text-emerald-700" title="Debtors' repayments received">Debtors in {c(bank.debtors)}</span>}
        {bank && bank.gOut > 0 && <span className="text-orange-600" title="Cash taken out for Grony">Grony out {c(bank.gOut)}</span>}
        {bank && bank.running != null && <span className="text-indigo-800" title="Last confirmed bank plus the movement since">Bank est. {c(bank.running)}</span>}
        {bank && bank.total != null
          ? <button type="button" onClick={() => setOpen(o => (o ? null : 'view'))} className={`rounded px-1 underline decoration-dotted ${off ? 'text-red-600' : 'text-green-700'}`}>✓ confirmed {c(bank.total)}{off ? ` (${(bank.deficit as number) > 0 ? '+' : '-'}${c(Math.abs(bank.deficit as number))})` : ''}</button>
          : bank ? <button type="button" onClick={() => setOpen(o => (o ? null : 'form'))} className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Confirm bank</button> : null}
      </div>
      {open === 'view' && bank?.parts && (
        <div className="mt-1.5 space-y-1 rounded-xl border border-gray-200 bg-white p-2.5 text-[13px] text-gray-800">
          <p><b>Bank</b> {c2(bank.parts.bank)} · <b>MoMo</b> {c2(bank.parts.momo)} · <b>Physical</b> {c2(bank.parts.physical)} · <b>Total</b> {c2(bank.total ?? 0)}</p>
          {bank.verify ? <p className={bank.verify.ok ? 'text-green-700' : 'text-red-600'}>{bank.verify.ok ? '✓ Matches the previous confirmation plus the movement since.' : `Previous confirmation plus the movement since gives ${c2(bank.verify.expected)}; this is ${bank.verify.diff > 0 ? '+' : '-'}${c2(Math.abs(bank.verify.diff))} different (money paid in or out that is not recorded).`}</p> : <p className="text-gray-500">The first confirmation: later ones are checked against it.</p>}
          <button type="button" onClick={() => setOpen('form')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-800">Edit</button>
        </div>)}
      {open === 'form' && bank && <ConfirmForm date={date} bank={bank} onDone={() => setOpen(null)} />}
    </div>
  )
}

// A line above each week of days: the week's net movement, the balance at its end and whether the bank was confirmed that week.
export function WeekHeader({ date }: { date: string }) {
  const { weeks } = useDayMoney()
  const w = weeks.get(weekStartOf(date)); if (!w) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[12px] font-bold text-indigo-900">
      <span>Week {shortDate(w.start)} to {shortDate(addDays(w.start, 6))}</span>
      <span>Net {w.net < 0 ? '-' : ''}{c(Math.abs(w.net))}</span>
      {w.endBalance != null && <span>Balance {c(w.endBalance)}</span>}
      {w.confirmed
        ? <span className="text-green-700">✓ confirmed {c(w.confirmed.total)}{w.confirmed.deficit != null && Math.abs(w.confirmed.deficit) >= 1 ? ` (${w.confirmed.deficit > 0 ? '+' : '-'}${c(Math.abs(w.confirmed.deficit))})` : ''}</span>
        : w.endDate ? <button type="button" onClick={() => openBankConfirm(w.endDate)} className="rounded bg-green-100 px-1.5 py-0.5 text-green-800">Not confirmed · Confirm week</button> : null}
    </div>
  )
}
