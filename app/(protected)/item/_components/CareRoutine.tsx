'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ACTIVITIES, BEHAVIOURS, HOUSE_CHORES, CHILDREN, NIGHT_CHECKS, NIGHT_SLOTS, dayKey, dayType, minutesOf, routineState, ROUTINE_GRACE_MIN, type CareEvent, type RoutineItem } from '@/lib/caretakerShared'
import { postCareEvent } from './careUtils'
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
  item: RoutineItem | null     // null = an extra activity or a night check
  kind: 'routine' | 'extra' | 'night'
  slot?: string                // night checks: '22:00' | '01:00' | '04:00'
  night?: string               // night checks: the evening the night began (YYYY-MM-DD)
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
      tiles.push({ key: `${item.id}-${child}`, child, time: item.time, title: item.title, important: item.important, item, kind: 'routine', ev, state })
    }
  }
  if (offset === 0) {
    for (const e of routineEvents) {
      const x = e.extra as { adhoc?: boolean; title?: string } | null
      if (!x?.adhoc || !e.child || (childFilter && e.child !== childFilter)) continue
      tiles.push({ key: `adhoc-${e.id}`, child: e.child, time: hhmm(e.recorded_at), title: x.title ?? 'Extra activity', important: false, item: null, kind: 'extra', ev: e, state: 'done' })
    }
  }
  // Night checks (10pm, 1am, 4am) are tiles too. The 1am and 4am checks of a
  // calendar day belong to the night that began the evening before.
  const prev = new Date(date.getTime() - 86400000)
  for (const slot of NIGHT_SLOTS) {
    const night = slot === '22:00' ? dayKey(date) : dayKey(prev)
    for (const child of CHILDREN) {
      if (childFilter && child !== childFilter) continue
      const ev = offset === 0
        ? events.find(e => e.kind === 'night' && e.child === child && (e.extra as { night?: string; slot?: string } | null)?.night === night && (e.extra as { slot?: string } | null)?.slot === slot)
        : undefined
      const m = minutesOf(slot)
      const state: Tile['state'] = offset > 0 ? 'future' : ev ? 'done' : nowMin >= m + ROUTINE_GRACE_MIN ? 'overdue' : nowMin >= m ? 'due' : 'upcoming'
      tiles.push({ key: `night-${slot}-${child}`, child, time: slot, title: 'Night check', important: false, item: null, kind: 'night', slot, night, ev, state })
    }
  }
  // Chronological: a recorded tile sits at the minute it was really tapped, a
  // waiting one at its planned time. So a child who bathes before another has
  // brushed teeth has the earlier tile, whatever the routine order says.
  const eff = (t: Tile) => minutesOf(t.ev && t.kind !== 'extra' ? hhmm(t.ev.recorded_at) : t.time)
  return tiles.sort((a, b) => eff(a) - eff(b) || minutesOf(a.time) - minutesOf(b.time) || childOrder(a.child) - childOrder(b.child))
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
// (about half a second) = edit sheet (done / not done / time taken / revert).
// Tapping a tile that already has a record opens the same sheet.
function TileButton({ t, photo, live, onTap, onEdit }: { t: Tile; photo?: string | null; live: boolean; onTap: () => void; onEdit: () => void }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const show = t.ev ? hhmm(t.ev.recorded_at) : t.time
  return (
    <button type="button" disabled={!live} title={`${t.child}: ${t.title}`}
      onPointerDown={() => { held.current = false; if (live) timer.current = setTimeout(() => { held.current = true; onEdit() }, 600) }}
      onPointerUp={() => { if (timer.current) clearTimeout(timer.current); if (live && !held.current) { if (t.ev) onEdit(); else onTap() } }}
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
export function DayTiles({ items, events, photos, date, offset, now, childFilter = null, onTap, onEdit }: {
  items: RoutineItem[]; events: CareEvent[]; photos: Record<string, string | null>; date: Date; offset: number; now: Date
  childFilter?: string | null; onTap: (t: Tile) => void; onEdit: (t: Tile) => void
}) {
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const tiles = buildTiles(items, events, date, offset, childFilter, nowMin)
  if (!tiles.length) return <p className="text-xs text-gray-400">Nothing planned.</p>
  // Runs of neighbouring tiles with the same activity share one label (max 4 a run).
  const groups: { key: string; title: string; important: boolean; tiles: Tile[] }[] = []
  for (const t of tiles) {
    const key = t.kind === 'routine' ? `${t.item?.id}` : t.kind === 'night' ? `n|${t.slot}` : `x|${t.title}`
    const g = groups[groups.length - 1]
    if (g && g.key === key && g.tiles.length < 4 && !childFilter) g.tiles.push(t)
    else groups.push({ key, title: t.title, important: t.important, tiles: [t] })
  }
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-2.5">
      {groups.map(g => (
        <div key={`${g.key}-${g.tiles[0].key}`} style={{ width: childFilter ? 'calc(25% - 6px)' : `calc(${g.tiles.length * 12.5}% - 4px)` }}>
          <p className="truncate text-[9px] font-semibold leading-tight text-gray-700" title={g.title}>{g.important ? '❗' : ''}{g.title}</p>
          <div className="flex gap-0.5 rounded-lg bg-gray-50 p-0.5">
            {g.tiles.map(t => (
              <TileButton key={t.key} t={t} photo={photos[t.child]} live={offset === 0}
                onTap={() => onTap(t)} onEdit={() => onEdit(t)} />
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
  const [behaviour, setBehaviour] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pick = (v: string, isBehaviour: boolean) => { setTitle(v); setBehaviour(isBehaviour) }

  async function save() {
    setBusy(true); setErr('')
    try {
      if (behaviour) {
        for (const child of kids) await postCareEvent({ child, kind: 'behaviour', value: title, note: note || null })
        onSaved(`Saved behaviour: ${title} for ${kids.join(', ')}`)
        onClose()
        setBusy(false)
        return
      }
      const res = await fetch('/api/caretaker/routine/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adhoc_title: title, done: kids, note: note || undefined }),
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
        <p className="text-xs font-bold uppercase text-gray-500">House chores</p>
        <div className="flex flex-wrap gap-2">
          {HOUSE_CHORES.map(a => (
            <button key={a} type="button" onClick={() => pick(a, false)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${!behaviour && title === a ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-800'}`}>{a}</button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Behaviour (logged against the child)</p>
        <div className="flex flex-wrap gap-2">
          {BEHAVIOURS.map(a => (
            <button key={a} type="button" onClick={() => pick(a, true)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${behaviour && title === a ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800'}`}>{a}</button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Other activities</p>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.filter(a => a !== 'Other').map(a => (
            <button key={a} type="button" onClick={() => pick(a, false)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${!behaviour && title === a ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800'}`}>{a}</button>
          ))}
        </div>
        <input value={title} onChange={e => pick(e.target.value, false)} placeholder="Or type what was done" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !title.trim() || kids.length === 0} onClick={() => void save()}
          className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save now'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}

const MINUTE_CHOICES = [5, 10, 15, 20, 30, 45, 60]

// Long-press / tap-on-record sheet for one tile: record Done / Not done, say
// how long it took, add a note, flip the answer, or revert it entirely.
export function TileSheet({ t, photo, onClose, onSaved }: { t: Tile; photo?: string | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const ex = (t.ev?.extra ?? {}) as { minutes?: number; support?: 'alone' | 'support' }
  const [support, setSupport] = useState<'alone' | 'support' | null>(ex.support ?? null)
  const [minutes, setMinutes] = useState<number | null>(ex.minutes ?? null)
  const [note, setNote] = useState(t.ev?.note ?? '')
  const [title, setTitle] = useState(t.title)
  const [time, setTime] = useState(t.time)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run(fn: () => Promise<Response>, msg: string) {
    setBusy(true); setErr('')
    try {
      const res = await fn()
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Could not save')
      onSaved(msg); onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const json = { 'Content-Type': 'application/json' }
  const record = (value: 'Done' | 'Not done') => run(() => fetch('/api/caretaker/routine/complete', {
    method: 'POST', headers: json,
    body: JSON.stringify({ routine_id: t.item?.id, done: value === 'Done' ? [t.child] : [], not_done: value === 'Done' ? [] : [t.child], minutes, support: support ?? undefined, note: note || undefined }),
  }), `${value}: ${t.child} · ${t.title}${minutes ? ` (${minutes} min)` : ''}`)
  const patch = (body: Record<string, unknown>, msg: string) => run(() => fetch(`/api/caretaker/events/${t.ev!.id}`, { method: 'PATCH', headers: json, body: JSON.stringify(body) }), msg)
  const revert = () => { if (confirm(`Remove this record and put "${t.title}" back to waiting for ${t.child}?`)) void run(() => fetch(`/api/caretaker/events/${t.ev!.id}`, { method: 'DELETE' }), `Reverted: ${t.child} · ${t.title}`) }
  const saveTile = () => run(() => fetch(`/api/caretaker/routine/${t.item!.id}`, {
    method: 'PUT', headers: json,
    body: JSON.stringify({ day_type: t.item!.day_type, time, title, scope: t.item!.scope, important: t.item!.important }),
  }), `Tile updated: ${title} at ${time}`)

  const isRoutine = t.kind === 'routine' && !!t.item
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[88vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Avatar name={t.child} url={photo} ring={RING[t.state]} />
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-gray-900">{t.child} · {t.title}</p>
            <p className="text-xs text-gray-500">{t.ev ? `${t.ev.value === 'Not done' ? 'Not done' : 'Recorded'} at ${hhmm(t.ev.recorded_at)} by ${t.ev.recorded_by}` : `Planned ${t.time} · not recorded yet`}</p>
          </div>
        </div>

        <p className="text-xs font-bold uppercase text-gray-500">Did they manage alone?</p>
        <div className="flex gap-2">
          {([['alone', 'Did it alone'], ['support', 'Had support']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSupport(support === k ? null : k)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${support === k ? (k === 'alone' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white') : 'bg-gray-100 text-gray-700'}`}>{label}</button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Time taken</p>
        <div className="flex flex-wrap items-center gap-2">
          {MINUTE_CHOICES.map(m => (
            <button key={m} type="button" onClick={() => setMinutes(minutes === m ? null : m)}
              className={`rounded-full px-3 py-2 text-sm font-semibold ${minutes === m ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>{m} min</button>
          ))}
          <input type="number" min={1} max={600} inputMode="numeric" value={minutes && !MINUTE_CHOICES.includes(minutes) ? minutes : ''} placeholder="Other"
            onChange={e => setMinutes(e.target.value ? Number(e.target.value) : null)} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        {err && <p className="text-sm text-red-600">{err}</p>}

        {!t.ev && isRoutine && (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void record('Done')} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Done now</button>
            <button type="button" disabled={busy} onClick={() => void record('Not done')} className="flex-1 rounded-xl bg-gray-600 py-3 text-base font-bold text-white disabled:opacity-40">Not done</button>
          </div>
        )}
        {t.ev && (
          <>
            <button type="button" disabled={busy} onClick={() => void patch({ minutes, support, note: note || null }, `Saved: ${t.child} · ${t.title}${minutes ? ` (${minutes} min)` : ''}`)}
              className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save changes</button>
            {t.kind === 'routine' && (
              <button type="button" disabled={busy} onClick={() => void patch({ value: t.ev!.value === 'Not done' ? 'Done' : 'Not done', minutes, support, note: note || null }, `Changed: ${t.child} · ${t.title}`)}
                className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white disabled:opacity-40">Change to {t.ev.value === 'Not done' ? 'Done' : 'Not done'}</button>
            )}
            <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (revert to waiting)</button>
          </>
        )}

        {isRoutine && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={() => setEditing(e => !e)} className="text-sm font-semibold text-blue-700">{editing ? 'Hide' : 'Edit this tile (name and planned time)'}</button>
            {editing && (
              <>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
                <button type="button" disabled={busy || !title.trim() || !time} onClick={() => void saveTile()} className="w-full rounded-xl bg-blue-600 py-3 text-base font-bold text-white disabled:opacity-40">Save tile</button>
                <p className="text-[11px] text-gray-500">Only the people supervising the caretaker can change a tile. This changes it for every child and every day.</p>
              </>
            )}
          </div>
        )}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

// Night check for one child at one time: tap what you found or did, then save.
export function NightSheet({ child, slot, night, photo, onClose, onSaved }: {
  child: string; slot: string; night: string; photo?: string | null; onClose: () => void; onSaved: (msg: string) => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save() {
    setBusy(true); setErr('')
    try {
      const s = await postCareEvent({ child, kind: 'night', value: slot, extra: { night, slot, checks: picked } })
      onSaved(`Saved: ${child} ${slot} night check at ${hhmm(s.recorded_at)}`)
      onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[88vh] w-full space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar name={child} url={photo} />
          <div>
            <p className="text-base font-bold text-gray-900">{child} · {slot} night check</p>
            <p className="text-xs text-gray-500">Look at {child}, then tap what you found or did.</p>
          </div>
        </div>
        {child === 'Fiifi' && <p className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">Fiifi wets the bed: wake him gently and help him to the toilet.</p>}
        <div className="flex flex-wrap gap-2">
          {NIGHT_CHECKS.map(c => (
            <button key={c.key} type="button" onClick={() => setPicked(p => p.includes(c.key) ? p.filter(k => k !== c.key) : [...p, c.key])}
              className={`rounded-full px-3 py-2.5 text-sm font-semibold ${picked.includes(c.key) ? (c.good ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white') : 'bg-gray-100 text-gray-700'}`}>{c.label}</button>
          ))}
        </div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || picked.length === 0} onClick={() => void save()}
          className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save now'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
