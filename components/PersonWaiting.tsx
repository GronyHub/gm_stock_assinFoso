'use client'
import { useEffect, useState } from 'react'
import type { MyDayItem } from '@/lib/myDay'
import { addDays, CHECKLIST_START } from '@/lib/dailyChecksShared'
import DateStrip from '@/components/DateStrip'
import TaskTile, { DensityToggle, tileGrid, useTileDensity, type TileDensity } from '@/components/TaskTile'
import MyDayClient from '@/app/(protected)/my-day/MyDayClient'

// Waiting for me: the same date strip as Waiting for team, filtered to one person. Today is their live list; another date holds only their own duties
// for that date (what they did, what they marked not done, what they missed; or what is planned for them).
export default function PersonWaiting({ forName = '', onNavigate }: { forName?: string; onNavigate?: (i: MyDayItem) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [sel, setSel] = useState(today)
  const [density, setDensity] = useTileDensity()
  const past: string[] = []
  for (let d = addDays(today, -1); d >= CHECKLIST_START && past.length < 60; d = addDays(d, -1)) past.unshift(d)
  const ahead: string[] = []
  for (let i = 1; i <= 31; i++) ahead.push(addDays(today, i))
  const dates = [...past, today, ...ahead]
  return (
    <div>
      <div className="sticky top-0 z-20 flex items-start gap-1 bg-white px-2 pb-1 pt-1">   {/* stays on screen while the tiles scroll under it */}
        <DateStrip dates={dates} sel={sel} today={today} onSel={setSel} />
        <DensityToggle density={density} onChange={setDensity} />
      </div>
      {sel === today
        ? <MyDayClient key={`${forName}`} forName={forName} onNavigate={onNavigate} density={density} lens="all" />
        : (
          <PersonDayTiles person={forName} date={sel} density={density} />)}
    </div>
  )
}

// One person's duties on a date other than today, as tiles. Earlier dates get a filter on how each ended; coming dates list what is planned.
export function PersonDayTiles({ person, date, density }: { person: string; date: string; density: TileDensity }) {
  const today = new Date().toISOString().slice(0, 10)
  const [items, setItems] = useState<MyDayItem[] | null>(null)
  const [f, setF] = useState<'all' | 'done' | 'not' | 'miss'>('all')
  useEffect(() => {
    let live = true; setItems(null)
    fetch(`/api/my-day?date=${date}${person ? `&for=${encodeURIComponent(person)}` : ''}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live) setItems(d?.items ?? []) }).catch(() => { if (live) setItems([]) })
    return () => { live = false }
  }, [date, person])
  const n = (st: string) => items?.filter(i => i.state === st).length ?? 0
  const shown = items?.filter(i => f === 'all' || i.state === f) ?? []
  return (
    <div className="space-y-1.5 p-2">
      {items === null && <p className="text-sm text-gray-400">Loading…</p>}
      {items && items.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing {date > today ? 'is planned' : 'fell'} for {person ? 'this person' : 'you'} on this day.</p>}
      {items && items.length > 0 && date < today && (
        <div className="flex flex-nowrap gap-1 overflow-x-auto">
          {([['all', 'Everything', items.length], ['done', 'Done', n('done')], ['not', 'Marked not done', n('not')], ['miss', 'Not done at all', n('miss')]] as const).map(([k, label, c]) => (
            <button key={k} type="button" onClick={() => setF(k)} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${f === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label} {c}</button>
          ))}
        </div>)}
      {items && shown.length > 0 && (
        <div className={tileGrid(density)}>
          {shown.map(i => (
            <TaskTile key={i.key} density={density} icon={i.icon} time={i.time} title={i.title} detail={i.detail} who={i.who} category={i.category} type={i.type}
              mark={i.state === 'done' ? 'done' : i.state === 'not' ? 'no' : i.state === 'miss' ? 'miss' : undefined}
              tone={i.state === 'done' ? 'border-green-400 bg-green-50' : i.state === 'not' ? 'border-gray-300 bg-gray-100' : i.state === 'miss' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'} />))}
        </div>)}
    </div>
  )
}
