'use client'
import { useRef, useState } from 'react'
import { HOUSE_AREAS, PHOTO_AREAS, dayKey, periodsFor } from '@/lib/caretakerShared'
import { hhmm, postCareEvent, uploadCarePhoto, useCareEvents } from './careUtils'

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
