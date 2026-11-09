'use client'
import { useEffect, useMemo, useState } from 'react'
import { addDays, appliesOn, dayKey, WEEKDAYS, WEEKDAY_LABEL, type CheckTile } from '@/lib/dailyChecksShared'

const END = '2026-12-31'
type Tile = CheckTile & { section: string; minutes: number | null; law_id: number | null; category: string | null }
const wd = (day: string) => WEEKDAYS[new Date(day + 'T00:00:00Z').getUTCDay()]
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

// The Daily Checklist laid out for every day from today to the end of the year: the shape of an ordinary day, then each date with what it
// holds. Built from the live tiles, so it follows every change made in Company Laws and the Tile Manager.
export default function PlanClient() {
  const [tiles, setTiles] = useState<Tile[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/daily-checks', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d?.tiles && setTiles(d.tiles)).catch(() => {})
  }, [])
  const today = dayKey()

  // What a given date holds: tiles for that weekday, weekly tiles on their weekday, monthly tiles on the 1st (due that month).
  const forDay = (day: string) => {
    if (!tiles) return [] as { t: Tile; when: string }[]
    const w = wd(day)
    const out: { t: Tile; when: string }[] = []
    for (const t of tiles) {
      if (t.kind === 'properties') continue
      if (t.frequency === 'daily' && appliesOn(t, day)) out.push({ t, when: t.time ?? '' })
      else if (t.frequency === 'weekly' && ((t.weekday && t.weekday === w) || (!t.weekday && w === 'mon'))) out.push({ t, when: t.time ?? '' })
      else if (t.frequency === 'monthly' && day.endsWith('-01')) out.push({ t, when: 'this month' })
    }
    return out.sort((a, b) => (a.when || '99').localeCompare(b.when || '99') || a.t.id - b.t.id)
  }
  const days = useMemo(() => { const l: string[] = []; for (let d = today; d <= END; d = addDays(d, 1)) l.push(d); return l }, [today])
  const typical = useMemo(() => forDay(days.find(d => wd(d) === 'tue') ?? today), [tiles, days]) // eslint-disable-line react-hooks/exhaustive-deps
  const mins = (rows: { t: Tile }[]) => rows.reduce((a, r) => a + (r.t.minutes ?? 0), 0)

  const Row = ({ r }: { r: { t: Tile; when: string } }) => (
    <li className="flex items-start gap-2 text-[12px]"><span className="w-12 shrink-0 font-bold text-gray-500">{r.when}</span><span className="flex-1 text-gray-900">{r.t.icon} {r.t.title}</span><span className="shrink-0 text-[10px] text-gray-400">{r.t.minutes ? `${r.t.minutes} min` : ''}</span></li>
  )
  const Fixed = ({ time, text }: { time: string; text: string }) => <li className="flex items-start gap-2 rounded-lg bg-indigo-50 px-1.5 py-1 text-[12px]"><span className="w-12 shrink-0 font-bold text-indigo-700">{time}</span><span className="text-indigo-900">{text}</span></li>

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2 print:hidden">
        <a href="/standards" className="text-sm text-gray-500">&larr; Daily Checklist</a>
        <h1 className="ml-2 mr-auto text-xl font-bold text-[#14213D]">Checklist plan to 31 December</h1>
        <button type="button" onClick={() => window.print()} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold">Print</button>
      </div>
      {!tiles && <p className="text-sm text-gray-400">Loading…</p>}
      {tiles && (<>
        <div className="mb-3 rounded-2xl border-2 border-[#14213D] bg-white p-3">
          <p className="mb-1 text-sm font-extrabold text-[#14213D]">An ordinary working day (Monday to Saturday)</p>
          <ul className="space-y-1">
            {typical.filter(r => r.when && r.when < '13:30').map(r => <Row key={r.t.id} r={r} />)}
            {typical.filter(r => r.when && r.when >= '13:30').map(r => <Row key={r.t.id} r={r} />)}
            <Fixed time="19:15" text="The owner and Joe get the day's summary: how many tiles were done." />
            <Fixed time="19:20" text="Day end: every task left undone costs everyone clocked in a shared point (1 to 3 a day). Managers-only tasks cost managers only." />
            <Fixed time="19:30" text="A clean week takes 5 points off." />
          </ul>
          <p className="mt-2 text-[11px] text-gray-500">{typical.length} tiles, about {mins(typical)} minutes on a typical day. Law reminders are not on the checklist: they come as a notice at login, after the first sale and at mid-day. Tiles with a weekday, a week or a month are added on top of this on their own days below. Sunday: the shop is closed.</p>
        </div>

        <p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">Every day from {dlabel(today)} to {dlabel(END)} ({days.length} days)</p>
        <div className="space-y-1">{days.map(d => {
          const rows = forDay(d), sunday = wd(d) === 'sun'
          const extra = rows.filter(r => r.t.frequency !== 'daily' || r.t.days)
          return (
            <div key={d} className={`rounded-xl border ${d === today ? 'border-green-500 bg-green-50' : sunday ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
              <button type="button" onClick={() => setOpen(open === d ? null : d)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left print:hidden">
                <span className="w-24 shrink-0 text-sm font-bold text-gray-900">{dlabel(d)}</span>
                {sunday ? <span className="text-xs text-gray-500">Shop closed</span> : <span className="flex-1 text-xs text-gray-600">{rows.length} tiles · about {mins(rows)} min{extra.length ? ` · ${extra.length} special: ${extra.slice(0, 2).map(r => r.t.title.slice(0, 28)).join(', ')}${extra.length > 2 ? '…' : ''}` : ''}</span>}
                <span className="text-xs text-gray-400">{open === d ? '▴' : '▾'}</span>
              </button>
              {(open === d) && !sunday && <ul className="space-y-1 border-t border-gray-100 p-2">{rows.map(r => <Row key={r.t.id} r={r} />)}</ul>}
              <div className="hidden px-2 pb-1 print:block"><p className="text-xs font-bold">{dlabel(d)} {sunday ? '(closed)' : ''}</p>{!sunday && <ul>{rows.map(r => <Row key={r.t.id} r={r} />)}</ul>}</div>
            </div>
          )
        })}</div>
      </>)}
    </div>
  )
}
