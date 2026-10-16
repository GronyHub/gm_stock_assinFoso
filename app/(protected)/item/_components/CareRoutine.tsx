'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
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

const RING: Record<Tile['state'], string> = {
  done: 'ring-green-500',
  notdone: 'ring-gray-400',
  overdue: 'ring-red-500',
  due: 'ring-amber-400',
  upcoming: 'ring-gray-300',
  future: 'ring-gray-200',
}
const TIME_COLOR: Record<Tile['state'], string> = {
  done: 'text-green-700', notdone: 'text-gray-500', overdue: 'text-red-600', due: 'text-amber-600', upcoming: 'text-gray-600', future: 'text-gray-400',
}

function Avatar({ name, url, ring }: { name: string; url?: string | null; ring?: string }) {
  const cls = `h-7 w-7 shrink-0 rounded-full ring-2 ${ring ?? 'ring-transparent'}`
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt={name} className={`${cls} object-cover`} />
    : <span className={`${cls} flex items-center justify-center bg-blue-100 text-xs font-bold text-blue-700`}>{name[0]}</span>
}

// One tiny tile = the child's photo + a time. Tap = done now. Press and hold
// (about half a second) = "not done".
function TileButton({ t, photo, live, onTap, onSkip }: { t: Tile; photo?: string | null; live: boolean; onTap: () => void; onSkip: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const show = t.ev ? hhmm(t.ev.recorded_at) : t.time
  return (
    <button type="button" disabled={!live} title={`${t.child}: ${t.title}`}
      onPointerDown={() => { held.current = false; if (live && (t.state === 'overdue' || t.state === 'due')) timer.current = setTimeout(() => { held.current = true; onSkip() }, 600) }}
      onPointerUp={() => { if (timer.current) clearTimeout(timer.current); if (live && !held.current) onTap() }}
      onPointerLeave={() => { if (timer.current) clearTimeout(timer.current) }}
      onContextMenu={e => e.preventDefault()}
      className="flex min-w-0 flex-1 select-none flex-col items-center gap-0.5 rounded-md py-0.5 disabled:cursor-default active:bg-gray-100">
      <span className="relative">
        <Avatar name={t.child} url={photo} ring={RING[t.state]} />
        {t.state === 'done' && <span className="absolute -right-1 -top-1 rounded-full bg-green-600 px-[3px] text-[7px] leading-3 text-white">✓</span>}
        {t.state === 'notdone' && <span className="absolute -right-1 -top-1 rounded-full bg-gray-500 px-[3px] text-[7px] leading-3 text-white">✕</span>}
      </span>
      <span className={`text-[9px] font-bold leading-none tabular-nums ${TIME_COLOR[t.state]}`}>{show}</span>
    </button>
  )
}

// A day's tiles. Tiles sharing an activity form a group: the activity name once,
// above its children's tiles, two groups per row (8 tiles a row). The tiles wrap
// into rows, so the day is read by scrolling down, not sideways.
export function DayTiles({ items, events, photos, date, offset, now, childFilter = null, onTap, onSkip }: {
  items: RoutineItem[]; events: CareEvent[]; photos: Record<string, string | null>; date: Date; offset: number; now: Date
  childFilter?: string | null; onTap: (t: Tile) => void; onSkip: (t: Tile) => void
}) {
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const tiles = buildTiles(items, events, date, offset, childFilter, nowMin)
  if (!tiles.length) return <p className="text-xs text-gray-400">Nothing planned.</p>
  const groups: { key: string; title: string; time: string; important: boolean; tiles: Tile[] }[] = []
  for (const t of tiles) {
    const key = t.item ? `${t.time}|${t.title}` : `x|${t.title}|${t.time}`
    let g = groups.find(x => x.key === key)
    if (!g) { g = { key, title: t.title, time: t.time, important: t.important, tiles: [] }; groups.push(g) }
    g.tiles.push(t)
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-2.5">
      {groups.map(g => (
        <div key={g.key} className={childFilter ? 'w-[calc(25%-6px)]' : 'w-[calc(50%-4px)]'}>
          <p className="truncate text-[9px] font-semibold leading-tight text-gray-700" title={g.title}>{g.important ? '❗' : ''}{g.title}</p>
          <div className="flex gap-0.5 rounded-lg bg-gray-50 p-0.5">
            {g.tiles.map(t => (
              <TileButton key={t.key} t={t} photo={photos[t.child]} live={offset === 0 && !t.ev && !!t.item}
                onTap={() => onTap(t)} onSkip={() => onSkip(t)} />
            ))}
          </div>
        </div>
      ))}
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
