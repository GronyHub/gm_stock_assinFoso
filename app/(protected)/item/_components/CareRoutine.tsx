'use client'
import { useCallback, useEffect, useState } from 'react'
import { CHILDREN, dayType, minutesOf, routineState, type CareEvent, type RoutineItem } from '@/lib/caretakerShared'
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

const applicable = (item: RoutineItem): string[] => item.scope === 'all' ? [...CHILDREN] : [item.scope]

// Which children already have a routine record for this item today.
export function recordsFor(item: RoutineItem, events: CareEvent[]) {
  const map = new Map<string, CareEvent>()
  for (const e of events) {
    if (e.kind === 'routine' && (e.extra as { routine_id?: number } | null)?.routine_id === item.id && e.child) map.set(e.child, e)
  }
  return map
}

const STATE_STYLE = {
  done: 'border-green-300 bg-green-50 text-green-900',
  overdue: 'border-red-300 bg-red-50 text-red-900',
  due: 'border-amber-300 bg-amber-50 text-amber-900',
  upcoming: 'border-gray-200 bg-white text-gray-800',
} as const

// A day's tiles. `child` set -> that child's own timeline (their tiles plus the
// all-children tiles); unset -> the whole day for everyone.
export function RoutineList({ items, events, child, now, onPick }: {
  items: RoutineItem[]; events: CareEvent[]; child: string | null; now: Date; onPick: (item: RoutineItem) => void
}) {
  const today = dayType(now)
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes()
  const [showDone, setShowDone] = useState(false)
  const mine = items
    .filter(i => i.day_type === today && (!child || i.scope === 'all' || i.scope === child))
    .sort((a, b) => minutesOf(a.time) - minutesOf(b.time) || a.id - b.id)
  const rows = mine.map(i => {
    const recs = recordsFor(i, events)
    const who = child ? [child] : applicable(i)
    const doneAll = who.every(c => recs.has(c))
    return { item: i, recs, who, doneAll, state: routineState(i, doneAll, nowMin) }
  })
  const pending = rows.filter(r => !r.doneAll)
  const done = rows.filter(r => r.doneAll)
  const nextId = pending.find(r => r.state === 'upcoming')?.item.id

  const tile = (r: typeof rows[number]) => {
    const missed = r.who.filter(c => !r.recs.has(c))
    const notDone = r.who.filter(c => r.recs.get(c)?.value === 'Not done')
    const last = [...r.recs.values()].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)).at(-1)
    return (
      <button key={r.item.id} type="button" onClick={() => onPick(r.item)}
        className={`w-full rounded-xl border px-3 py-2.5 text-left active:opacity-70 ${STATE_STYLE[r.state]} ${r.item.id === nextId ? 'ring-2 ring-blue-400' : ''}`}>
        <div className="flex items-start gap-3">
          <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{r.item.time}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{r.item.title}</p>
            <p className="mt-0.5 text-[11px] opacity-80">
              {r.item.scope === 'all' ? 'All children' : r.item.scope}
              {r.item.important ? ' · Important' : ''}
              {r.doneAll && last ? ` · recorded ${hhmm(last.recorded_at)}` : ''}
              {!r.doneAll && r.recs.size > 0 ? ` · still to record: ${missed.join(', ')}` : ''}
              {notDone.length ? ` · NOT done: ${notDone.join(', ')}` : ''}
              {!r.doneAll && r.state === 'overdue' ? ' · OVERDUE' : ''}
              {!r.doneAll && r.state === 'due' ? ' · due now' : ''}
              {r.item.id === nextId ? ' · NEXT' : ''}
            </p>
          </div>
          <span className="text-lg">{r.doneAll ? '✓' : ''}</span>
        </div>
      </button>
    )
  }

  if (!rows.length) return <p className="text-xs text-gray-400">No routine set for today yet.</p>
  return (
    <div className="space-y-2">
      {pending.length === 0 && <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">Everything on today&apos;s routine is recorded.</p>}
      {pending.map(tile)}
      {done.length > 0 && (
        <>
          <button type="button" onClick={() => setShowDone(s => !s)} className="text-xs font-semibold text-gray-500">
            {showDone ? 'Hide' : 'Show'} done ({done.length})
          </button>
          {showDone && done.map(tile)}
        </>
      )}
    </div>
  )
}

// Opens when a tile is tapped: choose which children it applies to, then save.
export function RoutineSheet({ item, events, child, onClose, onSaved }: {
  item: RoutineItem; events: CareEvent[]; child: string | null; onClose: () => void; onSaved: (msg: string) => void
}) {
  const recs = recordsFor(item, events)
  const who = child ? [child] : applicable(item)
  const open = who.filter(c => !recs.has(c))
  const [picked, setPicked] = useState<string[]>(open)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(markNotDone: boolean) {
    setBusy(true); setErr('')
    const done = markNotDone ? [] : picked
    const not_done = markNotDone ? picked : open.filter(c => !picked.includes(c))
    try {
      const res = await fetch('/api/caretaker/routine/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine_id: item.id, done, not_done: markNotDone ? picked : not_done, note }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Could not save')
      const t = Array.isArray(d) && d[0] ? hhmm(d[0].recorded_at) : ''
      onSaved(`Saved: ${item.title}${t ? ` at ${t}` : ''}`)
      onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-bold tabular-nums text-gray-500">{item.time}{item.important ? ' · Important' : ''}</p>
        <p className="mb-3 text-base font-bold text-gray-900">{item.title}</p>
        {open.length === 0 ? (
          <p className="text-sm text-green-700">Already recorded for everyone this applies to.</p>
        ) : (
          <>
            {who.length > 1 && (
              <>
                <p className="mb-1 text-xs text-gray-500">Done for these children (untick any who did not):</p>
                <div className="mb-3 flex flex-wrap gap-2">
                  {open.map(c => (
                    <button key={c} type="button" onClick={() => setPicked(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c])}
                      className={`rounded-xl px-4 py-3 text-sm font-bold ${picked.includes(c) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-500 line-through'}`}>{c}</button>
                  ))}
                </div>
              </>
            )}
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Short note (optional)"
              className="mb-3 w-full rounded-xl border border-gray-300 p-3 text-sm" />
            {err && <p className="mb-2 text-sm text-red-600">{err}</p>}
            <button type="button" disabled={busy || (who.length > 1 && picked.length === 0 && open.length === 0)} onClick={() => void save(false)}
              className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">
              {busy ? 'Saving…' : who.length > 1 && picked.length < open.length ? `Save (${picked.length} done, ${open.length - picked.length} not done)` : 'Done'}
            </button>
            <button type="button" disabled={busy} onClick={() => void save(true)}
              className="mt-2 w-full rounded-xl bg-red-50 py-3 text-sm font-bold text-red-700">Not done{who.length > 1 ? ' (for the ticked children)' : ''}</button>
          </>
        )}
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}
