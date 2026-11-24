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
  analytics: {
    weekly: { week: string; points: number; done: number; notDone: number; missed: number; minutes: number; sales: number }[]
    completion: { rate: number | null; team: number | null; areas: { cat: string; rate: number | null; team: number | null; missed: number }[] }
    patterns: { weekdays: { dow: number; done: number; missed: number; rate: number | null }[]; hours: { hour: number; n: number }[]; topMissedAreas: { cat: string; missed: number }[]; topMissedTasks: { title: string; n: number }[] }
    ranking: { rows: { measure: string; rank: number; of: number; value: number; unit: string }[]; flags: string[] } | null
  }
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// A small bar chart: one bar per week (or per item), the latest value written above its bar.
function Bars({ data, color, fmt = (n: number) => String(Math.round(n * 10) / 10) }: { data: { label: string; value: number }[]; color: string; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map(x => x.value))
  return (
    <div className="flex items-end gap-1" style={{ height: 84 }}>
      {data.map((x, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: '100%' }} title={`${x.label}: ${fmt(x.value)}`}>
          {i === data.length - 1 && <span className="text-[10px] font-bold leading-none text-gray-700">{fmt(x.value)}</span>}
          <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max(x.value > 0 ? 4 : 1, (x.value / max) * 56)}px` }} />
          <span className="mt-0.5 text-[9px] leading-none text-gray-400">{x.label}</span>
        </div>))}
    </div>
  )
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
        <p className={h}>Analytics</p>
        {(() => {
          const a = d.analytics, wk = a.weekly.slice(-12), lab = (w: string) => new Date(`${w}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })
          const series = (f: (x: typeof wk[number]) => number) => wk.map(x => ({ label: lab(x.week), value: f(x) }))
          const peak = a.patterns.hours.reduce((m, x) => (x.n > m.n ? x : m), { hour: -1, n: 0 })
          return (<div className="space-y-3">
            <div>
              <p className="text-[13px] font-bold text-gray-800">Completion rate</p>
              <p className="text-2xl font-extrabold tabular-nums text-gray-900">{a.completion.rate == null ? '—' : `${a.completion.rate}%`}{a.completion.team != null && <span className="ml-1 text-[12px] font-normal text-gray-400">team {a.completion.team}%</span>}</p>
              <p className="text-[12px] text-gray-500">Done out of everything that fell on them (done, not done with a reason, missed).</p>
              <div className="mt-1 space-y-1">
                {a.completion.areas.filter(x => x.rate != null).map(x => (
                  <div key={x.cat}><div className="flex items-baseline justify-between gap-2 text-[12px]"><span className="min-w-0 truncate font-semibold text-gray-800">{x.cat}</span><span className="shrink-0 tabular-nums text-gray-700">{x.rate}%{x.team != null && <span className="text-gray-400"> · team {x.team}%</span>}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${(x.rate ?? 0) >= 80 ? 'bg-green-500' : (x.rate ?? 0) >= 50 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${x.rate}%` }} /></div></div>))}
              </div>
            </div>
            {wk.length > 1 && (<div className="space-y-2">
              <p className="text-[13px] font-bold text-gray-800">Week by week</p>
              <div><p className="text-[11px] font-semibold text-green-700">Tasks done</p><Bars data={series(x => x.done)} color="bg-green-500" /></div>
              <div><p className="text-[11px] font-semibold text-red-700">Tasks missed</p><Bars data={series(x => x.missed)} color="bg-red-500" /></div>
              <div><p className="text-[11px] font-semibold text-red-700">Penalty points</p><Bars data={series(x => x.points)} color="bg-red-400" /></div>
              <div><p className="text-[11px] font-semibold text-blue-700">Hours at the shop</p><Bars data={series(x => x.minutes / 60)} color="bg-blue-500" /></div>
              <div><p className="text-[11px] font-semibold text-indigo-700">Sales</p><Bars data={series(x => x.sales)} color="bg-indigo-500" fmt={n => `₵${Math.round(n).toLocaleString('en-GB')}`} /></div>
            </div>)}
            <div>
              <p className="text-[13px] font-bold text-gray-800">Patterns</p>
              <p className="mt-0.5 text-[11px] font-semibold text-gray-500">Completion by weekday</p>
              <div className="mt-1 grid grid-cols-7 gap-1 text-center">
                {a.patterns.weekdays.map(w => (
                  <div key={w.dow} className={`rounded-lg py-1.5 ${w.rate == null ? 'bg-gray-50' : w.rate >= 80 ? 'bg-green-50' : w.rate >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
                    <p className="text-[10px] font-semibold text-gray-600">{DOW[w.dow]}</p><p className="text-[13px] font-extrabold tabular-nums text-gray-900">{w.rate == null ? '—' : `${Math.round(w.rate)}%`}</p><p className="text-[9px] text-gray-500">{w.done}✓ {w.missed}✗</p>
                  </div>))}
              </div>
              {a.patterns.hours.length > 0 && (<>
                <p className="mt-2 text-[11px] font-semibold text-gray-500">When tasks are done (hour of the day){peak.hour >= 0 ? `: busiest at ${String(peak.hour).padStart(2, '0')}:00` : ''}</p>
                <Bars data={a.patterns.hours.map(x => ({ label: String(x.hour), value: x.n }))} color="bg-teal-500" />
              </>)}
              {a.patterns.topMissedAreas.length > 0 && <p className="mt-2 text-[12px] text-gray-700"><b>Most missed areas:</b> {a.patterns.topMissedAreas.map(x => `${x.cat} (${x.missed})`).join(', ')}</p>}
              {a.patterns.topMissedTasks.length > 0 && (<div className="mt-1 text-[12px] text-gray-700"><b>Tasks missed most:</b><ul className="mt-0.5 list-disc pl-4">{a.patterns.topMissedTasks.map((x, i) => <li key={i}>{x.title} <span className="text-gray-500">({x.n}×)</span></li>)}</ul></div>)}
            </div>
            {a.ranking && (
              <div>
                <p className="text-[13px] font-bold text-gray-800">Ranking among the staff <span className="font-normal text-gray-400">· 1 is best</span></p>
                {a.ranking.flags.length > 0 && <div className="mt-1 space-y-1">{a.ranking.flags.map((f, i) => <p key={i} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold leading-snug text-red-800">⚠ {f}</p>)}</div>}
                <ul className="mt-1 divide-y divide-gray-100 text-[13px]">{a.ranking.rows.map(r => (
                  <li key={r.measure} className="flex items-baseline justify-between gap-2 py-1.5"><span className="min-w-0 flex-1 text-gray-900">{r.measure}</span>
                    <span className="shrink-0 tabular-nums text-gray-700">{r.unit === 'min' ? hm(r.value) : r.unit === '₵' ? money(r.value) : `${Math.round(r.value * 10) / 10}${r.unit === '%' ? '%' : ''}`} <b className={r.rank === 1 ? 'text-green-700' : r.rank === r.of ? 'text-red-700' : 'text-gray-600'}>· {r.rank} of {r.of}</b></span></li>))}</ul>
              </div>)}
          </div>)
        })()}
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
