'use client'
import { useEffect, useState } from 'react'

type Area = { cat: string; done: number; notDone: number; missed: number }
type D = {
  who: string; days: number; counting: boolean; startCounting: string
  points: { total: number; entries: { day: string; points: number; reason: string; status: string }[] }
  tasks: { done: number; notDone: number; missed: number; areas: Area[] }
  time: { daysWorked: number; minutes: number }
  attendance: { late: number; absent: number; backdated: number }
  sales: { total: number; count: number }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hm = (m: number) => `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`
const dlabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// The read-only record of one person, under the Waiting schedule: points, tasks done and not done by area, time at the shop, lateness and sales (last 30 days).
export default function PersonSummary({ who }: { who: string }) {
  const [d, setD] = useState<D | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    let live = true
    setD(null); setErr('')
    fetch(`/api/person-summary?who=${encodeURIComponent(who)}`, { cache: 'no-store' }).then(async r => { const j = await r.json().catch(() => ({})); if (!live) return; if (r.ok) setD(j.data ?? j); else setErr(j.error ?? 'Could not load.') }).catch(() => live && setErr('Could not load.'))
    return () => { live = false }
  }, [who])
  if (err) return <p className="mx-2 mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{err}</p>
  if (!d) return <p className="mx-2 mt-3 text-sm text-gray-400">Loading {cap(who)}&apos;s record…</p>
  const card = 'rounded-xl border border-gray-200 bg-white p-3'
  const h = 'text-[12px] font-extrabold uppercase tracking-wide text-gray-500'
  return (
    <div className="mx-2 mt-3 space-y-2 pb-4">
      <p className="text-[13px] font-bold text-gray-800">{cap(d.who)}: last {d.days} days <span className="font-normal text-gray-500">· read only</span></p>

      <div className={card}>
        <p className={h}>Penalty points</p>
        <p className="text-3xl font-extrabold tabular-nums text-gray-900">{d.points.total}</p>
        {!d.counting && <p className="text-[12px] text-blue-800">Pilot: points count from {dlabel(d.startCounting)}.</p>}
        {d.points.entries.length === 0
          ? <p className="text-[13px] text-green-700">No violations in the last {d.days} days.</p>
          : <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">{d.points.entries.length} violation{d.points.entries.length === 1 ? '' : 's'} in the last {d.days} days</summary>
              <ul className="mt-1 space-y-1 text-[12px] leading-snug text-gray-800">{d.points.entries.map((e, i) => <li key={i}><b>{dlabel(e.day)}</b> · {e.points} pt{e.status !== 'active' ? ` (${e.status})` : ''} · {e.reason}</li>)}</ul></details>}
      </div>

      <div className={card}>
        <p className={h}>Tasks</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-green-50 py-2"><p className="text-xl font-extrabold text-green-700">{d.tasks.done}</p><p className="text-[11px] font-semibold text-green-800">Done</p></div>
          <div className="rounded-lg bg-gray-100 py-2"><p className="text-xl font-extrabold text-gray-700">{d.tasks.notDone}</p><p className="text-[11px] font-semibold text-gray-700">Not done, with a reason</p></div>
          <div className="rounded-lg bg-red-50 py-2"><p className="text-xl font-extrabold text-red-700">{d.tasks.missed}</p><p className="text-[11px] font-semibold text-red-800">Missed</p></div>
        </div>
        {d.tasks.areas.length > 0 && (
          <details className="mt-2"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By area</summary>
            <div className="mt-1 divide-y divide-gray-100 text-[13px]">
              {d.tasks.areas.map(a => (
                <div key={a.cat} className="flex items-baseline justify-between gap-2 py-1.5"><span className="min-w-0 truncate font-semibold text-gray-900">{a.cat}</span>
                  <span className="shrink-0 tabular-nums"><span className="text-green-700">{a.done}</span> · <span className="text-gray-600">{a.notDone}</span> · <span className={a.missed ? 'font-bold text-red-700' : 'text-gray-400'}>{a.missed}</span></span></div>))}
              <p className="pt-1 text-[11px] text-gray-500">Done · not done with a reason · missed</p>
            </div></details>)}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={card}><p className={h}>At the shop</p><p className="text-lg font-extrabold text-gray-900">{hm(d.time.minutes)}</p><p className="text-[12px] text-gray-500">{d.time.daysWorked} day{d.time.daysWorked === 1 ? '' : 's'} worked</p></div>
        <div className={card}><p className={h}>Sales</p><p className="text-lg font-extrabold text-gray-900">₵{d.sales.total.toLocaleString('en-GB', { maximumFractionDigits: 2 })}</p><p className="text-[12px] text-gray-500">{d.sales.count} sale{d.sales.count === 1 ? '' : 's'} recorded</p></div>
      </div>

      <div className={card}>
        <p className={h}>Attendance</p>
        <div className="mt-1 flex flex-wrap gap-2 text-[13px] font-semibold">
          <span className={`rounded-full px-3 py-1 ${d.attendance.late ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>Late without telling: {d.attendance.late}</span>
          <span className={`rounded-full px-3 py-1 ${d.attendance.absent ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>Absent without notice: {d.attendance.absent}</span>
          <span className={`rounded-full px-3 py-1 ${d.attendance.backdated ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>Clock-in written early: {d.attendance.backdated}</span>
        </div>
      </div>
    </div>
  )
}
