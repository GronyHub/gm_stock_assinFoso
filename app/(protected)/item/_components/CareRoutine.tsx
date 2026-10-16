'use client'
import { useCallback, useEffect, useState } from 'react'
import { ACTIVITIES, CHILDREN, dayType, minutesOf, routineState, type CareEvent, type RoutineItem } from '@/lib/caretakerShared'
import { hhmm } from './careUtils'

export function useRoutine() {
  const [items, setItems] = useState<RoutineItem[]>([])
  const [error, setError] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/caretaker/routine')
      const d = await res.json()
      if (res.ok && Array.isArray(d)) { setItems(d); setError(false) } else setError(true)
    } catch { setError(true) }
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  return { items, error, refresh }
}

export type Tile = {
  key: string
  child: string
  time: string                 // planned time (guide); for an extra activity, the time it was done
  title: string
  important: boolean
  item: RoutineItem | null     // null = an extra (unplanned) activity
  ev?: CareEvent               // the record, once tapped
  state: 'done' | 'notdone' | 'overdue' | 'due' | 'upcoming' | 'future'
}

const childOrder = (c: string) => CHILDREN.indexOf(c as typeof CHILDREN[number])

// One tile per child per planned activity ("all children" activities become a
// tile for each child, tapped separately), plus any extra activities recorded.
export function buildTiles(items: RoutineItem[], events: CareEvent[], date: Date, offset: number, childFilter: string | null, nowMin: number): Tile[] {
  const dt = dayType(date)
  const tiles: Tile[] = []
  const routineEvents = events.filter(e => e.kind === 'routine' && e.child)
  for (const item of items.filter(i => i.day_type === dt)) {
    const kids = item.scope === 'all' ? [...CHILDREN] : [item.scope]
    for (const child of kids) {
      if (childFilter && child !== childFilter) continue
      const ev = offset === 0
        ? routineEvents.find(e => e.child === child && (e.extra as { routine_id?: number } | null)?.routine_id === item.id)
        : undefined
      const state: Tile['state'] = offset > 0 ? 'future'
        : ev ? (ev.value === 'Not done' ? 'notdone' : 'done')
        : routineState(item, false, nowMin)
      tiles.push({ key: `${item.id}-${child}`, child, time: item.time, title: item.title, important: item.important, item, ev, state })
    }
  }
  if (offset === 0) {
    for (const e of routineEvents) {
      const x = e.extra as { adhoc?: boolean; title?: string } | null
      if (!x?.adhoc || !e.child || (childFilter && e.child !== childFilter)) continue
      tiles.push({ key: `adhoc-${e.id}`, child: e.child, time: hhmm(e.recorded_at), title: x.title ?? 'Extra activity', important: false, item: null, ev: e, state: 'done' })
    }
  }
  return tiles.sort((a, b) => minutesOf(a.time) - minutesOf(b.time) || childOrder(a.child) - childOrder(b.child))
}

const STYLE: Record<Tile['state'], string> = {
  done: 'border-green-300 bg-green-50',
  notdone: 'border-gray-300 bg-gray-100 opacity-80',
  overdue: 'border-red-300 bg-red-50',
  due: 'border-amber-300 bg-amber-50',
  upcoming: 'border-gray-200 bg-white',
  future: 'border-gray-200 bg-gray-50',
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
    : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{name[0]}</span>
}

// A day's tiles wrapped into rows (scroll down, no sideways swiping).
export function DayTiles({ items, events, photos, date, offset, now, childFilter = null, onTap, onSkip }: {
  items: RoutineItem[]; events: CareEvent[]; photos: Record<string, string | null>; date: Date; offset: number; now: Date
  childFilter?: string | null; onTap: (t: Tile) => void; onSkip: (t: Tile) => void
}) {
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const tiles = buildTiles(items, events, date, offset, childFilter, nowMin)
  if (!tiles.length) return <p className="text-xs text-gray-400">Nothing planned.</p>
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map(t => {
        const live = offset === 0 && !t.ev && t.item
        return (
          <div key={t.key} className={`flex flex-col rounded-xl border p-2 ${STYLE[t.state]}`}>
            <button type="button" disabled={!live} onClick={() => onTap(t)} className="flex-1 text-left disabled:cursor-default active:opacity-70">
              <div className="flex items-center gap-2">
                <Avatar name={t.child} url={photos[t.child]} />
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-gray-900">{t.child}</p>
                  <p className="text-[11px] tabular-nums text-gray-500">
                    {t.item ? `Plan ${t.time}` : 'Extra'}{t.important ? ' · Important' : ''}
                  </p>
                </div>
              </div>
              <p className="mt-1.5 text-sm font-semibold leading-snug text-gray-900">{t.title}</p>
              <p className={`mt-1 text-[11px] font-bold ${t.state === 'done' ? 'text-green-700' : t.state === 'overdue' ? 'text-red-700' : t.state === 'due' ? 'text-amber-700' : 'text-gray-500'}`}>
                {t.state === 'done' && t.ev ? `✓ Done ${hhmm(t.ev.recorded_at)}`
                  : t.state === 'notdone' && t.ev ? `Not done ${hhmm(t.ev.recorded_at)}`
                  : t.state === 'overdue' ? 'OVERDUE · tap when done'
                  : t.state === 'due' ? 'Due now · tap when done'
                  : t.state === 'upcoming' ? 'Tap when done'
                  : 'Planned'}
              </p>
            </button>
            {live && (t.state === 'overdue' || t.state === 'due') && (
              <button type="button" onClick={() => onSkip(t)} className="mt-1 self-end text-[10px] font-semibold text-gray-500 underline">Not done</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// "+ Extra activity": an unplanned activity, recorded for the chosen children
// at the moment it is saved.
export function AddExtraSheet({ photos, onClose, onSaved }: { photos: Record<string, string | null>; onClose: () => void; onSaved: (msg: string) => void }) {
  const [kids, setKids] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/caretaker/routine/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adhoc_title: title, done: kids }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Could not save')
      onSaved(`Saved: ${title} for ${kids.join(', ')}`)
      onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[88vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold text-gray-900">Extra activity (not planned)</p>
        <div className="flex flex-wrap gap-2">
          {CHILDREN.map(c => (
            <button key={c} type="button" onClick={() => setKids(k => k.includes(c) ? k.filter(x => x !== c) : [...k, c])}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold ${kids.includes(c) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              <Avatar name={c} url={photos[c]} />{c}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.filter(a => a !== 'Other').map(a => (
            <button key={a} type="button" onClick={() => setTitle(a)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${title === a ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>{a}</button>
          ))}
        </div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Or type what was done" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !title.trim() || kids.length === 0} onClick={() => void save()}
          className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save now'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
