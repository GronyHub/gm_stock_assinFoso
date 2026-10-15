'use client'
import { useEffect, useRef, useState } from 'react'
import { ACTIVITIES, CHILDREN, OPTIONS, dayKey, isSchoolDay } from '@/lib/caretakerShared'
import { hhmm, postCareEvent, uploadCarePhoto, useCareEvents } from './careUtils'

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

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    fetch('/api/caretaker/children').then(r => r.json()).then(d => { if (Array.isArray(d)) setChildren(d) }).catch(() => {})
  }, [])

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3500) }

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
    <div className="px-3 pt-3 pb-24 space-y-4 max-w-xl mx-auto">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-bold text-gray-900">Care today</h1>
        <p className="text-sm text-gray-500 tabular-nums">{date} · {clock} GMT</p>
      </div>
      {error && <p className="text-xs text-red-600">Couldn&apos;t refresh the records. Your taps still save.</p>}

      <div className="grid grid-cols-2 gap-3">
        {children.map(c => {
          const mine = events.filter(e => e.child === c.name)
          const woke = mine.find(e => e.kind === 'wake')
          const last = mine.at(-1)
          return (
            <button key={c.name} type="button" onClick={() => setOpenChild(c.name)}
              className="rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm active:bg-blue-50">
              <div className="flex items-center gap-3">
                {c.photo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.photo_url} alt={c.name} className="h-14 w-14 rounded-full object-cover" />
                  : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">{c.name[0]}</span>}
                <div className="min-w-0">
                  <p className="font-bold text-gray-900">{c.name}</p>
                  <p className="text-[11px] text-gray-500">{woke ? `Woke ${hhmm(woke.recorded_at)}` : 'Not woken yet'}</p>
                </div>
              </div>
              <p className="mt-2 truncate text-[11px] text-gray-500">{last ? `Last: ${last.kind.replace('_', ' ')}${last.value ? ` · ${last.value}` : ''} ${hhmm(last.recorded_at)}` : 'No records yet'}</p>
            </button>
          )
        })}
      </div>

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

      {toast && <div className="fixed bottom-4 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-xl bg-gray-900/95 px-4 py-3 text-sm text-white shadow-lg">{toast}</div>}
      {openChild && (
        <ChildSheet child={children.find(c => c.name === openChild)!} onClose={() => setOpenChild(null)}
          onSaved={msg => { flash(msg); void refresh() }}
          onPhoto={url => setChildren(cs => cs.map(c => c.name === openChild ? { ...c, photo_url: url } : c))} />
      )}
    </div>
  )
}

function ChildSheet({ child, onClose, onSaved, onPhoto }: { child: ChildInfo; onClose: () => void; onSaved: (m: string) => void; onPhoto: (u: string) => void }) {
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
