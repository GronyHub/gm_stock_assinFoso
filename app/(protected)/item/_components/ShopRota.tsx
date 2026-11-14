'use client'
import { useState } from 'react'
import { RotaTab } from '../../staff/StaffClient'

const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']] as const
type Cell = { in: string; out: string } | null
type Week = Record<string, Record<string, Cell>>
const wk = (inn: string, out: string): Cell => ({ in: inn, out })
// The standard week the owner chose (James 7am to 5pm with Wednesday ending at 1pm).
const START: Week = {
  bino: { mon: wk('16:00', '19:00'), tue: wk('16:00', '19:00'), wed: wk('16:00', '19:00'), thu: wk('16:00', '19:00'), fri: wk('16:00', '19:00'), sat: wk('09:00', '18:00'), sun: null },
  joe: { mon: wk('08:00', '16:00'), tue: wk('08:00', '16:00'), wed: wk('08:00', '16:00'), thu: wk('08:00', '16:00'), fri: wk('08:00', '16:00'), sat: null, sun: wk('12:00', '18:00') },
  james: { mon: wk('07:00', '17:00'), tue: wk('07:00', '17:00'), wed: wk('07:00', '13:00'), thu: wk('07:00', '17:00'), fri: wk('07:00', '17:00'), sat: null, sun: null },
}
const hrs = (c: Cell) => (c ? (Number(c.out.slice(0, 2)) * 60 + Number(c.out.slice(3)) - Number(c.in.slice(0, 2)) * 60 - Number(c.in.slice(3))) / 60 : 0)
const ymd = (d: Date) => d.toISOString().slice(0, 10)

// The Shop's "Rota" tab: a standard week that fills the rota for a range of dates (so the Opener and Closer have names), then the rota itself.
// Staff clock in from the Times tab of their own profile; this tab only plans.
export default function ShopRota({ canManage }: { canManage: boolean }) {
  const [week, setWeek] = useState<Week>(START)
  const today = new Date()
  const [from, setFrom] = useState(ymd(today))
  const [to, setTo] = useState(ymd(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0))))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [key, setKey] = useState(0)
  const set = (n: string, d: string, f: 'in' | 'out', v: string) => setWeek(w => { const c = w[n][d] ?? { in: '09:00', out: '17:00' }; return { ...w, [n]: { ...w[n], [d]: v === '' && f === 'in' ? null : { ...c, [f]: v } } } })
  async function apply() {
    if (!confirm(`Fill the rota from ${from} to ${to} for Bino, Joe and James? Their existing entries on those dates are replaced.`)) return
    setBusy(true)
    const r = await fetch('/api/rota/pattern', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, week }) }); const j = await r.json().catch(() => ({}))
    setBusy(false); setMsg(r.ok ? `Rota set: ${j.days} days.` : (j.error ?? 'Could not set the rota.')); if (r.ok) setKey(k => k + 1)
  }
  return (
    <div className="space-y-3">
      {canManage && (
        <details className="rounded-xl border border-gray-300 bg-white p-2" open>
          <summary className="cursor-pointer text-sm font-bold text-gray-900">Standard week: fill the rota from it</summary>
          <p className="mt-1 text-[12px] text-gray-600">Enter each person&apos;s hours once; empty start = off. The earliest start of a day becomes its Opener and the latest finish its Closer.</p>
          <div className="mt-2 space-y-3">{Object.keys(week).map(n => (
            <div key={n}>
              <p className="mb-1 text-xs font-extrabold capitalize text-[#14213D]">{n} <span className="font-semibold text-gray-500">· {DAYS.reduce((a, [d]) => a + hrs(week[n][d]), 0)} h a week · about {Math.round(DAYS.reduce((a, [d]) => a + hrs(week[n][d]), 0) * 52 / 12)} h a month</span></p>
              <div className="grid grid-cols-7 gap-1">{DAYS.map(([d, label]) => (
                <div key={d} className="rounded-lg bg-gray-50 p-1 text-center">
                  <p className="text-[12px] font-bold text-gray-500">{label}</p>
                  <input type="time" value={week[n][d]?.in ?? ''} onChange={e => set(n, d, 'in', e.target.value)} className="w-full rounded border border-gray-300 px-0.5 py-0.5 text-[12px]" />
                  <input type="time" value={week[n][d]?.out ?? ''} disabled={!week[n][d]} onChange={e => set(n, d, 'out', e.target.value)} className="mt-0.5 w-full rounded border border-gray-300 px-0.5 py-0.5 text-[12px] disabled:opacity-40" />
                </div>))}</div>
            </div>))}</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[12px] font-semibold text-gray-700">From<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-0.5 w-full rounded-lg border border-gray-300 p-1.5 text-sm" /></label>
            <label className="text-[12px] font-semibold text-gray-700">To<input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-0.5 w-full rounded-lg border border-gray-300 p-1.5 text-sm" /></label>
          </div>
          <button type="button" disabled={busy} onClick={() => void apply()} className="mt-2 w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">{busy ? 'Setting…' : 'Fill the rota'}</button>
          {msg && <p className="mt-1 text-xs font-semibold text-gray-800">{msg}</p>}
        </details>
      )}
      <RotaTab key={key} canManage={canManage} />
    </div>
  )
}
