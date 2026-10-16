'use client'
import { useEffect, useRef, useState } from 'react'
import { ACTIVITIES, CHILDREN, OPTIONS, dayKey, isSchoolDay, type CareEvent, type RoutineItem } from '@/lib/caretakerShared'
import { hhmm, postCareEvent, uploadCarePhoto, useCareEvents } from './careUtils'
import { AddExtraSheet, DayTiles, NightSheet, TileSheet, useRoutine, type Tile } from './CareRoutine'

type ChildInfo = { name: string; photo_url: string | null }

// Beatrice's home screen: a tile per child, one-tap records, school run,
// activities and bedtime. Every record is stamped with the SERVER's time.
export default function CareToday() {
  const date = dayKey()
  const { events, error, refresh } = useCareEvents(date)
  const [children, setChildren] = useState<ChildInfo[]>(CHILDREN.map(name => ({ name, photo_url: null })))
  const [openChild, setOpenChild] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [now, setNow] = useState(() => new Date())
  const routine = useRoutine()
  const [addExtra, setAddExtra] = useState(false)
  const [nightPick, setNightPick] = useState<Tile | null>(null)
  const [undo, setUndo] = useState<number | null>(null)
  const [editTile, setEditTile] = useState<Tile | null>(null)
  // Per-device choice: tapping a tile opens its options page instead of recording at once.
  const [askOnTap, setAskOnTap] = useState(false)
  useEffect(() => { try { setAskOnTap(localStorage.getItem('care-ask-on-tap') === '1') } catch { /* ignore */ } }, [])
  function toggleAsk() { const v = !askOnTap; setAskOnTap(v); try { localStorage.setItem('care-ask-on-tap', v ? '1' : '0') } catch { /* ignore */ } }
  const photos: Record<string, string | null> = Object.fromEntries(children.map(c => [c.name, c.photo_url]))

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  // A tile in the left pane asks for a child's page to open.
  useEffect(() => {
    const open = (name?: string) => { if (name && (CHILDREN as readonly string[]).includes(name)) setOpenChild(name) }
    open(window.__careOpenChild); window.__careOpenChild = undefined
    const handler = (e: Event) => { open((e as CustomEvent<string>).detail); window.__careOpenChild = undefined }
    window.addEventListener('care-open-child', handler)
    return () => window.removeEventListener('care-open-child', handler)
  }, [])
  useEffect(() => {
    fetch('/api/caretaker/children').then(r => r.json()).then(d => { if (Array.isArray(d)) setChildren(d) }).catch(() => {})
  }, [])

  function flash(msg: string, undoId: number | null = null) {
    setToast(msg); setUndo(undoId)
    setTimeout(() => { setToast(''); setUndo(null) }, undoId ? 7000 : 3500)
  }

  // Tapping a tile records it NOW (server time); the planned time is only a guide.
  async function tapTile(t: Tile, notDone = false) {
    if (!t.item) return
    try {
      const res = await fetch('/api/caretaker/routine/complete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routine_id: t.item.id, done: notDone ? [] : [t.child], not_done: notDone ? [t.child] : [] }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Could not save')
      const ev = Array.isArray(d) ? d[0] : null
      flash(`${notDone ? 'Not done' : 'Saved'}: ${t.child} · ${t.title}${ev ? ` at ${hhmm(ev.recorded_at)}` : ''}`, ev?.id ?? null)
      void refresh()
    } catch (e) { flash(`NOT saved: ${(e as Error).message}. Try again.`) }
  }
  // Long press (or tapping a tile that already has a record) opens its edit sheet.
  function openTile(t: Tile) {
    if (t.kind === 'night' && !t.ev) setNightPick(t)
    else setEditTile(t)
  }
  async function undoLast() {
    if (!undo) return
    const id = undo
    setUndo(null); setToast('')
    const res = await fetch(`/api/caretaker/events/${id}`, { method: 'DELETE' })
    flash(res.ok ? 'Undone.' : 'Too late to undo.')
    void refresh()
  }

  async function quick(ev: Parameters<typeof postCareEvent>[0], label: string) {
    try {
      const saved = await postCareEvent(ev)
      flash(`Saved: ${label} at ${hhmm(saved.recorded_at)}`)
      void refresh()
    } catch (e) { flash(`NOT saved: ${(e as Error).message}. Try again.`) }
  }

  const house = (value: string) => events.filter(e => e.kind === 'house' && e.value === value).at(-1)
  const clock = `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`

  const houseButtons: { value: string; label: string; show: boolean }[] = [
    { value: 'car_left', label: 'Car left with the children', show: isSchoolDay(now) },
    { value: 'school_out', label: 'Children left school', show: isSchoolDay(now) },
    { value: 'home_back', label: 'Children back home', show: isSchoolDay(now) },
    { value: 'sweep_done', label: 'House swept (8pm)', show: true },
    { value: 'bedtime_done', label: 'All children in bed (8:30pm)', show: true },
  ]

  return (
    <div className="px-2 pt-2 pb-24 space-y-3 max-w-xl mx-auto">
      {error && <p className="text-xs text-red-600">Couldn&apos;t refresh the records. Your taps still save.</p>}

      <section className="space-y-4">
        {routine.error && <p className="text-xs text-red-600">Couldn&apos;t load the routine.</p>}
        {[0, 1, 2].map(offset => {
          const d = new Date(now.getTime() + offset * 86400000)
          const label = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : 'The day after'
          return (
            <div key={offset} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800">{label} · {d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}{offset === 0 ? ` · ${clock}` : ''}</h2>
                {offset === 0 && <button type="button" onClick={toggleAsk} className={`mr-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold ${askOnTap ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>{askOnTap ? 'Options on tap: ON' : 'Options on tap: off'}</button>}
                {offset === 0 && <button type="button" onClick={() => setAddExtra(true)} className="rounded-full bg-purple-600 px-3 py-1.5 text-xs font-bold text-white">+ Extra activity</button>}
              </div>
              {offset > 0 && <p className="text-[11px] text-gray-500">Look only. These can be recorded on the day.</p>}
              <DayTiles items={routine.items} events={events} photos={photos} date={d} offset={offset} now={now}
                onTap={t => t.kind === 'night' ? setNightPick(t) : askOnTap ? openTile(t) : void tapTile(t)} onEdit={openTile} />
            </div>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700">House</h2>
        <div className="grid grid-cols-1 gap-2">
          {houseButtons.filter(b => b.show).map(b => {
            const done = house(b.value)
            return (
              <button key={b.value} type="button" onClick={() => quick({ kind: 'house', value: b.value }, b.label)}
                className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${done ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} active:opacity-70`}>
                {b.label}{done ? `  ✓ ${hhmm(done.recorded_at)}` : ''}
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700">What are you doing with the children?</h2>
        <div className="flex flex-wrap gap-2">
          {ACTIVITIES.map(a => (
            <button key={a} type="button" onClick={() => quick({ kind: 'activity', value: a }, a)}
              className="rounded-full bg-purple-100 px-3 py-2 text-sm font-semibold text-purple-800 active:opacity-70">{a}</button>
          ))}
        </div>
      </section>

      <section className="space-y-1">
        <h2 className="text-sm font-bold text-gray-700">Latest records</h2>
        {events.length === 0 && <p className="text-xs text-gray-400">Nothing recorded yet today.</p>}
        {[...events].reverse().slice(0, 8).map(e => (
          <p key={e.id} className="text-xs text-gray-600">
            <span className="tabular-nums text-gray-400">{hhmm(e.recorded_at)}</span> {e.child ?? 'House'} · {e.kind.replace('_', ' ')}{e.value ? ` · ${e.value}` : ''}
          </p>
        ))}
      </section>

      {nightPick && nightPick.slot && nightPick.night && (
        <NightSheet child={nightPick.child} slot={nightPick.slot} night={nightPick.night} photo={photos[nightPick.child]}
          onClose={() => setNightPick(null)} onSaved={msg => { flash(msg); void refresh() }} />
      )}
      {editTile && <TileSheet key={editTile.key} t={editTile} photo={photos[editTile.child]} onClose={() => setEditTile(null)} onSaved={msg => { flash(msg); void refresh() }} />}
      {addExtra && <AddExtraSheet photos={photos} onClose={() => setAddExtra(false)} onSaved={msg => { flash(msg); void refresh() }} />}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex w-[92%] max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-lg">
          <span className="flex-1">{toast}</span>
          {undo && <button type="button" onClick={() => void undoLast()} className="rounded-lg bg-white/20 px-3 py-1 text-xs font-bold">Undo</button>}
        </div>
      )}
      {openChild && (
        <ChildSheet child={children.find(c => c.name === openChild)!} onClose={() => setOpenChild(null)}
          events={events} routine={routine.items} now={now} photos={photos} onTap={t => t.kind === 'night' ? setNightPick(t) : void tapTile(t)} onEdit={openTile}
          onSaved={msg => { flash(msg); void refresh() }}
          onPhoto={url => setChildren(cs => cs.map(c => c.name === openChild ? { ...c, photo_url: url } : c))} />
      )}
    </div>
  )
}

function ChildSheet({ child, events, routine, now, photos, onTap, onEdit, onClose, onSaved, onPhoto }: { child: ChildInfo; events: CareEvent[]; routine: RoutineItem[]; now: Date; photos: Record<string, string | null>; onTap: (t: Tile) => void; onEdit: (t: Tile) => void; onClose: () => void; onSaved: (m: string) => void; onPhoto: (u: string) => void }) {
  const [picker, setPicker] = useState<string | null>(null)
  const [hw, setHw] = useState<{ brought: string; done: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  async function save(ev: Parameters<typeof postCareEvent>[0], label: string) {
    setBusy(true)
    try { const s = await postCareEvent(ev); onSaved(`Saved: ${child.name} ${label} at ${hhmm(s.recorded_at)}`); setPicker(null); setHw(null); onClose() }
    catch (e) { onSaved(`NOT saved: ${(e as Error).message}. Try again.`) }
    setBusy(false)
  }
  async function changePhoto(f: File | undefined) {
    if (!f) return
    try {
      const url = await uploadCarePhoto(f)
      await fetch('/api/caretaker/children', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: child.name, photo_url: url }) })
      onPhoto(url)
    } catch (e) { onSaved(`Photo not saved: ${(e as Error).message}`) }
  }

  const actions: { key: string; label: string }[] = [
    { key: 'wake', label: 'Woke up' }, { key: 'health', label: 'Health' }, { key: 'meal', label: 'Food given' },
    { key: 'behaviour', label: 'Bad behaviour' }, { key: 'school_need', label: 'School needs' }, { key: 'homework', label: 'Homework' },
    { key: 'skin', label: 'Skin check' }, { key: 'hair', label: 'Hair check' },
  ]

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3">
        <button type="button" onClick={() => (picker || hw) ? (setPicker(null), setHw(null)) : onClose()} className="text-2xl text-gray-600" aria-label="Back">←</button>
        {child.photo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={child.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{child.name[0]}</span>}
        <p className="flex-1 text-lg font-bold text-gray-900">{child.name}</p>
        <button type="button" onClick={() => photoRef.current?.click()} className="text-xs font-semibold text-blue-600">Photo</button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={e => void changePhoto(e.target.files?.[0])} />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!picker && !hw && (
          <div className="grid grid-cols-2 gap-3">
            {actions.map(a => (
              <button key={a.key} type="button" disabled={busy}
                onClick={() => a.key === 'wake' ? void save({ child: child.name, kind: 'wake', value: 'Woke up' }, 'woke up')
                  : a.key === 'homework' ? setHw({ brought: '', done: '' }) : setPicker(a.key)}
                className="rounded-2xl bg-blue-50 px-3 py-6 text-center text-base font-bold text-blue-800 active:bg-blue-100">{a.label}</button>
            ))}
          </div>
        )}
        {!picker && !hw && (
          <div className="mt-5 space-y-5">
            <section className="space-y-2">
              <h2 className="text-sm font-bold text-gray-700">{child.name}&apos;s routine today</h2>
              <DayTiles items={routine} events={events} photos={photos} date={now} offset={0} now={now} childFilter={child.name} onTap={onTap} onEdit={onEdit} />
            </section>
            <section className="space-y-1">
              <h2 className="text-sm font-bold text-gray-700">What has happened today</h2>
              {events.filter(e => e.child === child.name).length === 0 && <p className="text-xs text-gray-400">Nothing recorded for {child.name} yet today.</p>}
              {[...events].filter(e => e.child === child.name).reverse().map(e => (
                <p key={e.id} className="text-xs text-gray-600">
                  <span className="tabular-nums text-gray-400">{hhmm(e.recorded_at)}</span>{' '}
                  {e.kind === 'routine' ? `${(e.extra as { title?: string } | null)?.title ?? 'Routine'} · ${e.value}` : `${e.kind.replace('_', ' ')}${e.value ? ` · ${e.value}` : ''}`}
                  {e.note ? ` — ${e.note}` : ''}
                </p>
              ))}
            </section>
          </div>
        )}
        {picker && <OptionPicker kind={picker} busy={busy} onSave={(value, note, photo) => save({ child: child.name, kind: picker, value, note, photo_url: photo }, OPTIONS[picker].label.toLowerCase())} />}
        {hw && (
          <div className="space-y-4">
            <p className="text-base font-bold text-gray-800">Homework today</p>
            {(['brought', 'done'] as const).map(k => (
              <div key={k}>
                <p className="mb-1 text-sm text-gray-600">{k === 'brought' ? 'How many homeworks came home?' : 'How many have been done?'}</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setHw({ ...hw, [k]: String(n) })}
                      className={`h-12 w-12 rounded-xl text-lg font-bold ${hw[k] === String(n) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" disabled={busy || hw.brought === '' || hw.done === ''}
              onClick={() => void save({ child: child.name, kind: 'homework', value: `${hw.done} of ${hw.brought} done`, extra: { brought: Number(hw.brought), done: Number(hw.done) } }, 'homework')}
              className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">Save homework</button>
          </div>
        )}
      </div>
    </div>
  )
}

function OptionPicker({ kind, busy, onSave }: { kind: string; busy: boolean; onSave: (value: string, note: string, photo: string | null) => void }) {
  const cfg = OPTIONS[kind]
  const [value, setValue] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    setUploading(true); setErr('')
    try { setPhoto(await uploadCarePhoto(f)) } catch (e) { setErr((e as Error).message) }
    setUploading(false)
  }
  return (
    <div className="space-y-4">
      <p className="text-base font-bold text-gray-800">{cfg.label}</p>
      <div className="flex flex-wrap gap-2">
        {cfg.values.map(v => (
          <button key={v} type="button" onClick={() => setValue(v)}
            className={`rounded-xl px-4 py-3 text-sm font-semibold ${value === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{v}</button>
        ))}
      </div>
      {cfg.note && <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Short note (optional)"
        className="w-full rounded-xl border border-gray-300 p-3 text-sm" />}
      {cfg.photo && (
        <div>
          <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void pick(e.target.files?.[0])} />
          <button type="button" onClick={() => ref.current?.click()} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-800">
            {uploading ? 'Uploading…' : photo ? 'Photo added ✓ (tap to change)' : 'Take a photo (optional)'}
          </button>
          {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
        </div>
      )}
      <button type="button" disabled={busy || uploading || !value} onClick={() => value && onSave(value, note, photo)}
        className="w-full rounded-xl bg-green-600 py-4 text-base font-bold text-white disabled:opacity-40">Save now</button>
    </div>
  )
}
