'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROUTINE_SECTIONS, type ShopEvent, type ShopTile } from '@/lib/shopRoutineShared'

const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const evTime = (e: ShopEvent) => e.extra?.done_at ?? hhmm(e.recorded_at)
const MINUTES = [5, 10, 15, 20, 30, 45, 60]
const json = { 'Content-Type': 'application/json' }

export default function RoutineClient({ canEdit }: { canEdit: boolean }) {
  const [tiles, setTiles] = useState<ShopTile[]>([])
  const [events, setEvents] = useState<ShopEvent[]>([])
  const [section, setSection] = useState<string>('Opening')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<ShopTile | null>(null)
  const [adding, setAdding] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const load = useCallback(async () => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch('/api/shop-routine', { cache: 'no-store' })
        const d = await r.json()
        if (r.ok && Array.isArray(d.tiles)) { setTiles(d.tiles); setEvents(d.events); setError(''); return }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 700 * (i + 1)))
    }
    setError('Could not load the routine. Pull down to try again.')
  }, [])
  useEffect(() => {
    void load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load() }, 90000)
    return () => clearInterval(t)
  }, [load])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const latest = (id: number) => events.filter(e => e.routine_id === id).at(-1)
  const inSection = (s: string) => tiles.filter(t => t.section === s)
  const doneCount = (s: string) => inSection(s).filter(t => latest(t.id)?.value === 'Done').length

  async function tap(t: ShopTile) {
    try {
      const r = await fetch('/api/shop-routine/tap', { method: 'POST', headers: json, body: JSON.stringify({ routine_id: t.id }) })
      if (!r.ok) throw new Error()
      flash(`Done: ${t.title}`); void load()
    } catch { flash('NOT saved. Try again.') }
  }

  const shown = inSection(section)
  const sections = ROUTINE_SECTIONS.filter(s => ['Opening', 'Daytime', 'Closing'].includes(s) || inSection(s).length || canEdit)

  return (
    <div className="mx-auto max-w-2xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Shop Routine</h1>
        {canEdit && <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">+ Add tile</button>}
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap gap-1.5 bg-white/95 py-2">
        {sections.map(s => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${section === s ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>
            {s}{inSection(s).length ? ` ${doneCount(s)}/${inSection(s).length}` : ''}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-gray-500">Tap a tile when you have done it. Press and hold (or tap a finished tile) for options: not done, time taken, note, undo.</p>
      {shown.length === 0 && <p className="text-sm text-gray-400">Nothing here yet.{canEdit ? ' Use + Add tile.' : ''}</p>}
      <div className="grid grid-cols-2 gap-2">
        {shown.map(t => {
          const ev = latest(t.id)
          const state = ev ? (ev.value === 'Not done' ? 'notdone' : 'done') : 'todo'
          return (
            <button key={t.id} type="button" onContextMenu={e => e.preventDefault()}
              onPointerDown={() => { held.current = false; timer.current = setTimeout(() => { held.current = true; setSheet(t) }, 600) }}
              onPointerUp={() => { if (timer.current) clearTimeout(timer.current); if (!held.current) { if (ev) setSheet(t); else void tap(t) } }}
              onPointerLeave={() => { if (timer.current) clearTimeout(timer.current) }}
              className={`min-h-[84px] select-none rounded-xl border-2 p-2 text-left ${state === 'done' ? 'border-green-500 bg-green-50' : state === 'notdone' ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-white'} active:opacity-70`}>
              <p className="line-clamp-4 text-xs font-semibold leading-snug text-gray-900">{t.title}</p>
              <p className={`mt-1 text-[11px] font-bold ${state === 'done' ? 'text-green-700' : state === 'notdone' ? 'text-gray-500' : 'text-gray-400'}`}>
                {ev ? `${ev.value === 'Not done' ? '✕ Not done' : '✓'} ${evTime(ev)} · ${ev.recorded_by}${ev.extra?.minutes ? ` · ${ev.extra.minutes}m` : ''}` : t.time ? `Plan ${t.time}` : 'Tap when done'}
              </p>
            </button>
          )
        })}
      </div>
      {sheet && <TileSheet t={sheet} ev={latest(sheet.id)} canEdit={canEdit} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load() }} />}
      {adding && <TileForm section={section} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load() }} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{toast}</div>}
    </div>
  )
}

function TileSheet({ t, ev, canEdit, onClose, onSaved }: { t: ShopTile; ev?: ShopEvent; canEdit: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [minutes, setMinutes] = useState<number | null>(ev?.extra?.minutes ?? null)
  const [support, setSupport] = useState<'alone' | 'support' | null>(ev?.extra?.support ?? null)
  const [doneAt, setDoneAt] = useState(ev?.extra?.done_at ?? '')
  const [note, setNote] = useState(ev?.note ?? '')
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(t.title)
  const [time, setTime] = useState(t.time ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function run(fn: () => Promise<Response>, msg: string) {
    setBusy(true); setErr('')
    try {
      const r = await fn(); const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save')
      onSaved(msg); onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  const record = (value: 'Done' | 'Not done') => run(() => fetch('/api/shop-routine/tap', { method: 'POST', headers: json,
    body: JSON.stringify({ routine_id: t.id, value, minutes, support: support ?? undefined, done_at: doneAt || undefined, note: note || undefined }) }), `${value}: ${t.title}`)
  const patch = (extra: Record<string, unknown>, msg: string) => run(() => fetch(`/api/shop-routine/events/${ev!.id}`, { method: 'PATCH', headers: json,
    body: JSON.stringify({ minutes, support, done_at: doneAt || null, note: note || null, ...extra }) }), msg)
  const revert = () => { if (confirm('Remove this record and put the tile back to waiting?')) void run(() => fetch(`/api/shop-routine/events/${ev!.id}`, { method: 'DELETE' }), 'Reverted') }
  const saveTile = () => run(() => fetch(`/api/shop-routine/${t.id}`, { method: 'PUT', headers: json, body: JSON.stringify({ title, section: t.section, time }) }), 'Tile updated')
  const removeTile = () => { if (confirm('Remove this tile from the routine? Past records are kept.')) void run(() => fetch(`/api/shop-routine/${t.id}`, { method: 'DELETE' }), 'Tile removed') }
  const ago = (m: number) => { const base = ev ? new Date(ev.recorded_at) : new Date(); const d = new Date(base.getTime() - m * 60000); setDoneAt(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`) }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[88vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold text-gray-900">{t.title}</p>
          <p className="text-xs text-gray-500">{ev ? `${ev.value === 'Not done' ? 'Not done' : 'Done'} at ${evTime(ev)} (logged ${hhmm(ev.recorded_at)}) by ${ev.recorded_by}` : 'Not recorded yet'}</p>
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Did you manage alone?</p>
        <div className="flex gap-2">
          {([['alone', 'Did it alone'], ['support', 'Had support']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSupport(support === k ? null : k)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold ${support === k ? (k === 'alone' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white') : 'bg-gray-100 text-gray-700'}`}>{l}</button>
          ))}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Time it was done {ev ? `(logged at ${hhmm(ev.recorded_at)})` : '(blank = now)'}</p>
        <div className="flex flex-wrap items-center gap-2">
          {[5, 10, 15, 30, 60].map(m => <button key={m} type="button" onClick={() => ago(m)} className="rounded-full bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800">{m} min ago</button>)}
          <input type="time" value={doneAt} onChange={e => setDoneAt(e.target.value)} className="rounded-xl border border-gray-300 p-2 text-sm" />
          {doneAt && <button type="button" onClick={() => setDoneAt('')} className="text-xs font-semibold text-gray-500">Clear</button>}
        </div>
        <p className="text-xs font-bold uppercase text-gray-500">Time taken</p>
        <div className="flex flex-wrap items-center gap-2">
          {MINUTES.map(m => <button key={m} type="button" onClick={() => setMinutes(minutes === m ? null : m)}
            className={`rounded-full px-3 py-2 text-sm font-semibold ${minutes === m ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>{m} min</button>)}
          <input type="number" min={1} max={600} inputMode="numeric" placeholder="Other" value={minutes && !MINUTES.includes(minutes) ? minutes : ''}
            onChange={e => setMinutes(e.target.value ? Number(e.target.value) : null)} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" />
        </div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!ev ? (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void record('Done')} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Done now</button>
            <button type="button" disabled={busy} onClick={() => void record('Not done')} className="flex-1 rounded-xl bg-gray-600 py-3 text-base font-bold text-white disabled:opacity-40">Not done</button>
          </div>
        ) : (
          <>
            <button type="button" disabled={busy} onClick={() => void patch({}, 'Saved')} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save changes</button>
            <button type="button" disabled={busy} onClick={() => void patch({ value: ev.value === 'Not done' ? 'Done' : 'Not done' }, 'Changed')} className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white disabled:opacity-40">Change to {ev.value === 'Not done' ? 'Done' : 'Not done'}</button>
            <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (revert to waiting)</button>
          </>
        )}
        {canEdit && (
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={() => setEditing(v => !v)} className="text-sm font-semibold text-blue-700">{editing ? 'Hide' : 'Edit this tile'}</button>
            {editing && (
              <>
                <input value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
                <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
                <button type="button" disabled={busy || !title.trim()} onClick={() => void saveTile()} className="w-full rounded-xl bg-blue-600 py-3 text-base font-bold text-white disabled:opacity-40">Save tile</button>
                <button type="button" disabled={busy} onClick={removeTile} className="w-full py-2 text-sm font-semibold text-red-600">Remove this tile</button>
              </>
            )}
          </div>
        )}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

function TileForm({ section, onClose, onSaved }: { section: string; onClose: () => void; onSaved: () => void }) {
  const [sec, setSec] = useState(section)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [err, setErr] = useState('')
  async function save() {
    const r = await fetch('/api/shop-routine', { method: 'POST', headers: json, body: JSON.stringify({ section: sec, title, time }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) setErr(d.error ?? 'Could not save'); else onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-2xl space-y-3 rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Add a tile</p>
        <select value={sec} onChange={e => setSec(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm">
          {ROUTINE_SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What must be done" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        <p className="text-[11px] text-gray-500">The time is only a guide and can be left empty.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={!title.trim()} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Add tile</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
