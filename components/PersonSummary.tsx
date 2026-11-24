'use client'
import { useEffect, useMemo, useState } from 'react'

type Area = { cat: string; done: number; notDone: number; missed: number }
type Task = { day: string; time: string; title: string; category: string | null; law_id: number | null; outcome: 'done' | 'notDone' | 'missed'; note: string | null }
type D = {
  who: string; from: string; to: string; counting: boolean; startCounting: string
  team: { people: number; done: number; notDone: number; missed: number; points: number; minutes: number; daysWorked: number; sales: number; late: number; absent: number; backdated: number } | null
  points: { total: number; inRange: number; entries: { day: string; points: number; reason: string; status: string }[]; byLaw: { law_id: number | null; name: string; points: number; n: number }[]; byMonth: { month: string; points: number; n: number }[] }
  tasks: { done: number; notDone: number; missed: number; areas: Area[]; list: Task[] }
  time: { daysWorked: number; minutes: number; fullDays: number; perDay: { day: string; in: string | null; out: string | null; minutes: number | null; lateMin: number }[]; perWeek: { week: string; minutes: number; days: number; lateMin: number }[] }
  attendance: { late: number; absent: number; backdated: number }
  sales: { total: number; count: number; perDay: { day: string; total: number; n: number }[]; byGroup: { grp: string; total: number; n: number }[] }
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const hm = (m: number) => (m <= 0 ? '0 min' : m >= 60 ? `${Math.floor(m / 60)} h${Math.round(m % 60) ? ` ${Math.round(m % 60)} min` : ''}` : `${Math.round(m)} min`)
const dl = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const money = (n: number) => `₵${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
const ymd = (d: Date) => d.toISOString().slice(0, 10)
const ago = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return ymd(d) }

// The read-only record of one person, under the Waiting schedule. A period switch (7, 30, 90 days or two dates) changes every figure; the owner and Joe also see the team average beside each number.
export default function PersonSummary({ who }: { who: string }) {
  const [range, setRange] = useState<'7' | '30' | '90' | 'dates'>('30')
  const [from, setFrom] = useState(ago(30))
  const [to, setTo] = useState(ymd(new Date()))
  const [d, setD] = useState<D | null>(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState<'all' | 'done' | 'notDone' | 'missed'>('all')
  const [area, setArea] = useState('')
  const q = useMemo(() => range === 'dates' ? { from, to } : { from: ago(Number(range)), to: ymd(new Date()) }, [range, from, to])
  useEffect(() => {
    let live = true
    setD(null); setErr('')
    fetch(`/api/person-summary?who=${encodeURIComponent(who)}&from=${q.from}&to=${q.to}`, { cache: 'no-store' }).then(async r => { const j = await r.json().catch(() => ({})); if (!live) return; if (r.ok) setD(j.data ?? j); else setErr(j.error ?? 'Could not load.') }).catch(() => live && setErr('Could not load.'))
    return () => { live = false }
  }, [who, q.from, q.to])

  const card = 'rounded-xl border border-gray-200 bg-white p-3'
  const h = 'text-[12px] font-extrabold uppercase tracking-wide text-gray-500'
  const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${on ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`
  const tm = (v: number | undefined, fmt: (n: number) => string = n => String(n)) => (d?.team && v !== undefined ? <span className="ml-1 text-[11px] font-normal text-gray-400">team {fmt(v)}</span> : null)
  const list = useMemo(() => (d?.tasks.list ?? []).filter(t => (filter === 'all' || t.outcome === filter) && (!area || (t.category ?? 'Other') === area)), [d, filter, area])

  const switcher = (
    <div className="space-y-1.5">
      <div className="flex flex-nowrap gap-1 overflow-x-auto">
        {([['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['dates', 'Dates']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setRange(k)} className={chip(range === k)}>{l}</button>)}
      </div>
      {range === 'dates' && <div className="flex items-center gap-2"><input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-[14px]" /><span className="text-gray-500">to</span><input type="date" value={to} min={from} max={ymd(new Date())} onChange={e => setTo(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-[14px]" /></div>}
    </div>
  )
  if (err) return <div className="mx-2 mt-3 space-y-2">{switcher}<p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{err}</p></div>
  if (!d) return <div className="mx-2 mt-3 space-y-2">{switcher}<p className="text-sm text-gray-400">Loading {cap(who)}&apos;s record…</p></div>

  return (
    <div className="mx-2 mt-3 space-y-2 pb-4">
      <p className="text-[13px] font-bold text-gray-800">{cap(d.who)}: {dl(d.from)} to {dl(d.to)} <span className="font-normal text-gray-500">· read only{d.team ? ` · team is ${d.team.people} people` : ''}</span></p>
      {switcher}

      <div className={card}>
        <p className={h}>Penalty points</p>
        <p className="text-3xl font-extrabold tabular-nums text-gray-900">{d.points.total}<span className="ml-2 text-[13px] font-semibold text-gray-500">now</span></p>
        <p className="text-[13px] text-gray-700">{d.points.inRange} point{d.points.inRange === 1 ? '' : 's'} in this period{tm(d.team?.points)}</p>
        {!d.counting && <p className="text-[12px] text-blue-800">Pilot: points count from {dl(d.startCounting)}.</p>}
        {d.points.byLaw.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By law</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.points.byLaw.map((l, i) => <li key={i} className="flex items-baseline justify-between gap-2 py-1.5"><span className="min-w-0 flex-1 leading-snug text-gray-900">{l.name}</span><span className="shrink-0 tabular-nums font-bold text-red-700">{l.points} pt <span className="font-normal text-gray-500">· {l.n}×</span></span></li>)}</ul></details>)}
        {d.points.byMonth.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By month</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.points.byMonth.map(m => <li key={m.month} className="flex items-center justify-between gap-2 py-1.5"><span className="font-semibold text-gray-900">{new Date(`${m.month}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span><span className="tabular-nums"><b className="text-red-700">{m.points} pt</b> <span className="text-gray-500">· {m.n} entr{m.n === 1 ? 'y' : 'ies'}</span></span></li>)}</ul></details>)}
        {d.points.entries.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">Every entry ({d.points.entries.length})</summary>
            <ul className="mt-1 space-y-1 text-[12px] leading-snug text-gray-800">{d.points.entries.map((e, i) => <li key={i}><b>{dl(e.day)}</b> · {e.points} pt{e.status !== 'active' ? ` (${e.status})` : ''} · {e.reason}</li>)}</ul></details>)}
        {d.points.entries.length === 0 && <p className="mt-1 text-[13px] text-green-700">No violations in this period.</p>}
      </div>

      <div className={card}>
        <p className={h}>Tasks</p>
        <div className="mt-1 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-green-50 py-2"><p className="text-xl font-extrabold text-green-700">{d.tasks.done}</p><p className="text-[11px] font-semibold text-green-800">Done{tm(d.team?.done)}</p></div>
          <div className="rounded-lg bg-gray-100 py-2"><p className="text-xl font-extrabold text-gray-700">{d.tasks.notDone}</p><p className="text-[11px] font-semibold text-gray-700">Not done, with a reason{tm(d.team?.notDone)}</p></div>
          <div className="rounded-lg bg-red-50 py-2"><p className="text-xl font-extrabold text-red-700">{d.tasks.missed}</p><p className="text-[11px] font-semibold text-red-800">Missed{tm(d.team?.missed)}</p></div>
        </div>
        {d.tasks.areas.length > 0 && (
          <details className="mt-2"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By area</summary>
            <div className="mt-1 divide-y divide-gray-100 text-[13px]">
              {d.tasks.areas.map(a => (
                <div key={a.cat} className="flex items-baseline justify-between gap-2 py-1.5"><span className="min-w-0 truncate font-semibold text-gray-900">{a.cat}</span>
                  <span className="shrink-0 tabular-nums"><span className="text-green-700">{a.done}</span> · <span className="text-gray-600">{a.notDone}</span> · <span className={a.missed ? 'font-bold text-red-700' : 'text-gray-400'}>{a.missed}</span></span></div>))}
              <p className="pt-1 text-[11px] text-gray-500">Done · not done with a reason · missed</p>
            </div></details>)}
        <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">Task list ({d.tasks.list.length})</summary>
          <div className="mt-1 space-y-1.5">
            <div className="flex flex-nowrap gap-1 overflow-x-auto">
              {([['all', 'All'], ['done', 'Done'], ['notDone', 'Not done'], ['missed', 'Missed']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} className={chip(filter === k)}>{l}</button>)}
            </div>
            <select value={area} onChange={e => setArea(e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-2 text-[14px]"><option value="">All areas</option>{d.tasks.areas.map(a => <option key={a.cat} value={a.cat}>{a.cat}</option>)}</select>
            <ul className="divide-y divide-gray-100 text-[13px]">
              {list.length === 0 && <li className="py-2 text-gray-500">Nothing matches.</li>}
              {list.slice(0, 150).map((t, i) => (
                <li key={i} className="py-1.5 leading-snug">
                  <span className={`mr-1 font-bold ${t.outcome === 'done' ? 'text-green-700' : t.outcome === 'missed' ? 'text-red-700' : 'text-gray-600'}`}>{t.outcome === 'done' ? '✓' : t.outcome === 'missed' ? '✗' : '–'}</span>
                  <span className="text-gray-500">{dl(t.day)} {t.time}</span> · {t.title}{t.category ? <span className="text-gray-500"> · {t.category}</span> : null}{t.note ? <span className="block text-[12px] italic text-gray-600">{t.note}</span> : null}
                </li>))}
              {list.length > 150 && <li className="py-1.5 text-[12px] text-gray-500">Showing the latest 150. Narrow the dates or area to see the rest.</li>}
            </ul>
          </div></details>
      </div>

      <div className={card}>
        <p className={h}>At the shop</p>
        <p className="text-lg font-extrabold text-gray-900">{hm(d.time.minutes)}{tm(d.team?.minutes, hm)}</p>
        <p className="text-[12px] text-gray-500">{d.time.daysWorked} day{d.time.daysWorked === 1 ? '' : 's'} worked{tm(d.team?.daysWorked)}. Hours counted on the {d.time.fullDays} with both a time in and a time out.</p>
        {d.time.perWeek.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By week</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.time.perWeek.map(w => <li key={w.week} className="flex items-baseline justify-between gap-2 py-1.5"><span className="font-semibold text-gray-900">Week of {dl(w.week)}</span><span className="tabular-nums text-gray-700">{hm(w.minutes)} · {w.days} day{w.days === 1 ? '' : 's'}{w.lateMin ? <b className="text-red-700"> · late {hm(w.lateMin)}</b> : null}</span></li>)}</ul></details>)}
        {d.time.perDay.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By day</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.time.perDay.map(r => <li key={r.day} className="flex items-baseline justify-between gap-2 py-1.5"><span className="font-semibold text-gray-900">{dl(r.day)}</span><span className="tabular-nums text-gray-700">{r.in ?? '—'} to {r.out ?? 'no time out'}{r.minutes != null ? ` · ${hm(r.minutes)}` : ''}{r.lateMin ? <b className="text-red-700"> · late {hm(r.lateMin)}</b> : null}</span></li>)}</ul></details>)}
      </div>

      <div className={card}>
        <p className={h}>Sales</p>
        <p className="text-lg font-extrabold text-gray-900">{money(d.sales.total)}{tm(d.team?.sales, money)}</p>
        <p className="text-[12px] text-gray-500">{d.sales.count} sale{d.sales.count === 1 ? '' : 's'} recorded</p>
        {d.sales.byGroup.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By item group</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.sales.byGroup.map(g => <li key={g.grp} className="flex items-baseline justify-between gap-2 py-1.5"><span className="min-w-0 flex-1 truncate font-semibold text-gray-900">{g.grp}</span><span className="shrink-0 tabular-nums text-gray-700">{money(g.total)} <span className="text-gray-500">· {g.n}</span></span></li>)}</ul></details>)}
        {d.sales.perDay.length > 0 && (
          <details className="mt-1"><summary className="cursor-pointer text-[13px] font-semibold text-blue-700">By day</summary>
            <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{d.sales.perDay.map(r => <li key={r.day} className="flex items-baseline justify-between gap-2 py-1.5"><span className="font-semibold text-gray-900">{dl(r.day)}</span><span className="tabular-nums text-gray-700">{money(r.total)} <span className="text-gray-500">· {r.n}</span></span></li>)}</ul></details>)}
      </div>

      <div className={card}>
        <p className={h}>Attendance</p>
        <div className="mt-1 flex flex-wrap gap-2 text-[13px] font-semibold">
          <span className={`rounded-full px-3 py-1 ${d.attendance.late ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>Late without telling: {d.attendance.late}{tm(d.team?.late)}</span>
          <span className={`rounded-full px-3 py-1 ${d.attendance.absent ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>Absent without notice: {d.attendance.absent}{tm(d.team?.absent)}</span>
          <span className={`rounded-full px-3 py-1 ${d.attendance.backdated ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>Clock-in written early: {d.attendance.backdated}{tm(d.team?.backdated)}</span>
        </div>
      </div>
    </div>
  )
}
