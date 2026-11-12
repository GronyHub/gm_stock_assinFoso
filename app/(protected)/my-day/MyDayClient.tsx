'use client'
import { useEffect, useState } from 'react'
import type { MyDayItem } from '@/lib/myDay'
import ClockNotices from '@/components/ClockNotices'
import PenaltyDecisions from '@/components/PenaltyDecisions'
import ClockApprovals from '@/components/ClockApprovals'
import TaskTile, { DensityToggle, tileGrid, useTileDensity, type TileDensity } from '@/components/TaskTile'


const TONE = { now: 'border-red-300 bg-red-50', soon: 'border-amber-300 bg-amber-50', later: 'border-gray-200 bg-white' } as const
const TAG = { now: 'Now', soon: 'Today', later: 'When you can' } as const

// Waiting for me: everything the signed-in person owes or must decide, from every part of the app, most urgent first.
export default function MyDayClient({ onNavigate, forName = '', lens = 'todo', team = false, density: densityProp }: { onNavigate?: (i: MyDayItem) => void; forName?: string; lens?: 'todo' | 'notdone' | 'all'; team?: boolean; density?: TileDensity } = {}) {
  const [items, setItems] = useState<MyDayItem[] | null>(null)
  const [ownDensity, setDensity] = useTileDensity()
  const [filter, setFilter] = useState<'all' | 'waiting' | 'overdue' | 'done'>('all')
  const density = densityProp ?? ownDensity
  const [owners, setOwners] = useState<Record<string, string[]>>({})
  // A supervisor looking at a team member's list gets it from that person's own page (forName): read-only, with a reminder button.
  const who = forName
  const [msg, setMsg] = useState('')
  const load = (w = who) => fetch('/api/my-day?' + (team ? 'team=1' : `lens=${lens}` + (w ? `&for=${encodeURIComponent(w)}` : '')), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { setItems(d?.items ?? []); setOwners(d?.who ?? {}) }).catch(() => setItems([]))
  useEffect(() => { setItems(null); void load(forName) }, [forName, lens, team])
  // Whatever gets done leaves the list (it is then in Done): refresh when the tab is shown again and every minute.
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') void load(forName) }
    document.addEventListener('visibilitychange', again); window.addEventListener('focus', again)
    const t = setInterval(again, 60000)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forName, lens, team])
  async function remind() {
    const r = await fetch('/api/my-day/remind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: who }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? (j.message ?? 'Reminder sent.') : (j.error ?? 'Could not send.')); setTimeout(() => setMsg(''), 4000)
  }
  const go = (i: MyDayItem) => { if (onNavigate) { onNavigate(i); return } if (i.hub) window.parent.postMessage({ type: 'open-personal', tab: i.hub }, window.location.origin); else if (i.href) window.location.href = i.href }
  const everything = items?.filter(i => !(i.inline && !who && lens !== 'notdone')) ?? []
  // "Done" holds only what was really finished; an "all clear" tile (nothing waiting) is not work done.
  const isDone = (i: MyDayItem) => (i.state === 'done' || i.state === 'not') && !i.clear
  const isOver = (i: MyDayItem) => !i.state && i.count > 0 && (i.key.startsWith('task-') || i.key === 'tasks-more' || i.urgency === 'now')
  const isOpen = (i: MyDayItem) => !i.state && !isOver(i)
  const filtered = filter === 'done' ? everything.filter(isDone) : filter === 'overdue' ? everything.filter(isOver) : filter === 'waiting' ? everything.filter(isOpen) : everything
  const shown = lens === 'notdone' || team ? everything : filtered
  const waiting = everything.filter(i => i.urgency !== 'later').reduce((n, i) => n + i.count, 0)
  const overdue = everything.filter(i => i.urgency === 'now').reduce((n, i) => n + i.count, 0)
  const name = who ? who.charAt(0).toUpperCase() + who.slice(1) : ''
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3">
      {/* One compact row: counts on the left, refresh and remind as icons on phones (words from sm up). The tab already names the list. */}
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 text-xs font-semibold text-gray-700">
          {!(who || team || lens === 'notdone' || onNavigate) && <span className="mr-2 text-base font-extrabold text-[#14213D]">Waiting for me</span>}
          {items && (team || lens === 'notdone') ? `${shown.reduce((n, i) => n + i.count, 0)} not done today. A point only if still undone at day end.` : ''}
          {who && !onNavigate ? <span className="text-gray-400"> View only.</span> : null}
        </p>
        {!densityProp && <DensityToggle density={density} onChange={setDensity} />}
        {who && (lens === 'notdone' ? shown.length > 0 : true) && <button type="button" onClick={() => void remind()} title={`Remind ${name}`} aria-label={`Remind ${name}`} className="shrink-0 rounded-lg bg-[#14213D] px-2.5 py-1.5 text-xs font-bold text-white">🔔<span className="hidden sm:inline"> Remind {name}</span></button>}
        <button type="button" onClick={() => void load()} title="Refresh" aria-label="Refresh" className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700">↻<span className="hidden sm:inline"> Refresh</span></button>
      </div>
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {!who && !team && lens !== 'notdone' && <ClockNotices onChange={() => void load()} />}
      {!who && !team && lens !== 'notdone' && <div className={tileGrid(density)}><ClockApprovals density={density} /></div>}
      {!who && !team && lens !== 'notdone' && <PenaltyDecisions onChange={() => void load()} />}
      {items === null && <p className="text-sm text-gray-500">Loading…</p>}
      {items && !shown.length && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">✅ {team || lens === 'notdone' ? 'Nothing is overdue.' : `Nothing is waiting${who ? ` for ${name}` : ' for you'}.`}</p>}
      {!team && lens !== 'notdone' && items && (
        <div className="flex flex-wrap gap-1">
          {([['all', 'Everything', everything.length], ['waiting', 'Waiting', everything.filter(isOpen).length], ['overdue', 'Overdue', everything.filter(isOver).length], ['done', 'Done', everything.filter(isDone).length]] as const).map(([k, label, n]) => (
            <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label} {n}</button>
          ))}
        </div>)}
      <div className={tileGrid(density)}>
        {shown.map(i => (
          <TaskTile key={i.key} density={density} icon={i.icon} time={i.time ?? (i.state ? undefined : TAG[i.urgency])} title={i.title} detail={i.detail} who={i.who} category={i.category} type={i.type} badge={i.count}
            mark={i.state === 'done' ? 'done' : i.state === 'not' ? 'no' : undefined}
            tone={i.state === 'done' ? 'border-green-400 bg-green-50' : i.state === 'not' ? 'border-gray-300 bg-gray-100' : i.urgency === 'now' ? 'border-red-300 bg-red-50' : i.urgency === 'soon' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}
            onClick={!who && (i.href || i.hub) ? () => go(i) : undefined} />))}
      </div>
    </div>
  )
}
