'use client'
import { useRef, useState } from 'react'
import { CHILDREN, HOUSE_AREAS, NIGHT_CHECKS, NIGHT_SLOTS, PHOTO_AREAS, dayKey, periodsFor } from '@/lib/caretakerShared'
import { hhmm, postCareEvent, uploadCarePhoto, useCareEvents } from './careUtils'

function nightDate(now = new Date()) {
  // The 01:00 and 04:00 checks belong to the night that began the evening before.
  const d = new Date(now)
  if (d.getUTCHours() < 12) d.setUTCDate(d.getUTCDate() - 1)
  return dayKey(d)
}
function defaultSlot(now = new Date()) {
  const h = now.getUTCHours() + now.getUTCMinutes() / 60
  if (h >= 3) return h < 12 ? '04:00' : '22:00'      // 03:00-12:00 -> 04:00 check, else evening check
  if (h >= 0 && h < 3) return '01:00'
  return '22:00'
}

export function CareNight() {
  const now = new Date()
  const night = nightDate(now)
  const today = useCareEvents(dayKey(now))
  const prev = useCareEvents(dayKey(new Date(now.getTime() - 86400000)))
  const [slot, setSlot] = useState<string>(defaultSlot(now))
  const [draft, setDraft] = useState<Record<string, string[]>>({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')

  const all = [...prev.events, ...today.events].filter(e => e.kind === 'night' && (e.extra as { night?: string } | null)?.night === night)
  const saved = (child: string) => all.find(e => e.child === child && (e.extra as { slot?: string } | null)?.slot === slot)

  function toggle(child: string, key: string) {
    setDraft(d => {
      const cur = d[`${slot}|${child}`] ?? []
      return { ...d, [`${slot}|${child}`]: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] }
    })
  }
  async function save(child: string) {
    const checks = draft[`${slot}|${child}`] ?? []
    if (!checks.length) return
    setBusy(child); setMsg('')
    try {
      const s = await postCareEvent({ child, kind: 'night', value: slot, extra: { night, slot, checks } })
      setMsg(`Saved: ${child} ${slot} check at ${hhmm(s.recorded_at)}`)
      await Promise.all([today.refresh(), prev.refresh()])
    } catch (e) { setMsg(`NOT saved: ${(e as Error).message}. Try again.`) }
    setBusy('')
  }

  return (
    <div className="px-3 pt-3 pb-24 space-y-4 max-w-xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">Night checks</h1>
      <div className="flex gap-2">
        {NIGHT_SLOTS.map(s => (
          <button key={s} type="button" onClick={() => setSlot(s)}
            className={`flex-1 rounded-xl py-3 text-base font-bold ${slot === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{s}</button>
        ))}
      </div>
      <p className="text-xs text-gray-500">Go to each child&apos;s bed, look, and tap what you found or did. Then press Save for that child.</p>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('NOT') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>{msg}</p>}
      {CHILDREN.map(child => {
        const done = saved(child)
        const picked = done ? ((done.extra as { checks?: string[] } | null)?.checks ?? []) : (draft[`${slot}|${child}`] ?? [])
        return (
          <div key={child} className={`rounded-2xl border p-3 ${done ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-gray-900">{child}</p>
              {done && <span className="text-xs font-semibold text-green-700">Checked ✓ {hhmm(done.recorded_at)}</span>}
            </div>
            {child === 'Fiifi' && !done && <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">Fiifi wets the bed: wake him gently and help him to the toilet.</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              {NIGHT_CHECKS.map(c => (
                <button key={c.key} type="button" disabled={!!done} onClick={() => toggle(child, c.key)}
                  className={`rounded-full px-3 py-2 text-sm font-semibold ${picked.includes(c.key) ? (c.good ? 'bg-green-600 text-white' : 'bg-indigo-600 text-white') : 'bg-gray-100 text-gray-700'} disabled:opacity-80`}>{c.label}</button>
              ))}
            </div>
            {!done && (
              <button type="button" disabled={busy === child || picked.length === 0} onClick={() => void save(child)}
                className="mt-3 w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy === child ? 'Saving…' : `Save ${child}`}</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function CareRules() {
  const date = dayKey()
  const { events, refresh } = useCareEvents(date)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [photoFor, setPhotoFor] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  const tick = (value: string) => events.filter(e => e.kind === 'house' && e.value === value).at(-1)

  async function record(value: string, photo?: string) {
    setBusy(value); setMsg('')
    try {
      const s = await postCareEvent({ kind: 'house', value, photo_url: photo ?? null })
      setMsg(`Saved at ${hhmm(s.recorded_at)}`)
      await refresh()
    } catch (e) { setMsg(`NOT saved: ${(e as Error).message}. Try again.`) }
    setBusy('')
  }
  async function onPhoto(f: File | undefined) {
    const value = photoFor
    setPhotoFor(null)
    if (!f || !value) return
    setBusy(value)
    try { const url = await uploadCarePhoto(f); await record(value, url) } catch (e) { setMsg(`Photo not saved: ${(e as Error).message}`); setBusy('') }
  }

  return (
    <div className="px-3 pt-3 pb-24 space-y-5 max-w-xl mx-auto">
      <h1 className="text-lg font-bold text-gray-900">House rules today</h1>
      <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void onPhoto(e.target.files?.[0])} />
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('Saved') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{msg}</p>}

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700">With the children</h2>
        <p className="text-xs text-gray-500">No phone calls near the children. Sit with them in the living room when there is nothing else to do.</p>
        {periodsFor(new Date()).map(p => (
          <div key={p} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-gray-800">{p}</p>
            <div className="grid grid-cols-1 gap-2">
              {[{ k: 'no_calls', label: 'No calls near the children' }, { k: 'sat_with_children', label: 'Sat with the children' }].map(r => {
                const v = `rule:${r.k}:${p}`; const t = tick(v)
                return (
                  <button key={v} type="button" disabled={!!t || busy === v} onClick={() => void record(v)}
                    className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ${t ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {r.label}{t ? `  ✓ ${hhmm(t.recorded_at)}` : ''}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-700">Cleaning: no cobwebs anywhere</h2>
        <p className="text-xs text-gray-500">Deep clean while the children are at school. Bathrooms need a photo.</p>
        {HOUSE_AREAS.map(a => {
          const v = `rule:clean:${a}`; const t = tick(v); const needsPhoto = PHOTO_AREAS.has(a)
          return (
            <button key={a} type="button" disabled={!!t || busy === v}
              onClick={() => { if (needsPhoto) { setPhotoFor(v); ref.current?.click() } else void record(v) }}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold ${t ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
              {a}{needsPhoto && !t ? '  (photo)' : ''}{t ? `  ✓ clean ${hhmm(t.recorded_at)}` : ''}
            </button>
          )
        })}
      </section>
    </div>
  )
}
