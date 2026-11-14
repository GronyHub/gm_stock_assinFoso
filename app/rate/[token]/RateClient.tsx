'use client'
import { useState } from 'react'

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

export default function RateClient({ token, valid, already, staff }: { token: string; valid: boolean; already: boolean; staff: string }) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [done, setDone] = useState(already)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function send() {
    if (!stars) return
    setBusy(true); setErr('')
    try {
      const r = await fetch(`/api/public/rate/${token}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stars, comment }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Please try again')
      setDone(true)
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-5 py-8 text-center">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#14213D]">Grony Multimedia</p>
      <p className="text-[12px] text-gray-500">Assin Foso, near GCB Bank</p>
      {!valid && <p className="mt-8 text-sm text-gray-600">This rating link is not valid. Thank you for choosing us.</p>}
      {valid && done && (
        <div className="mt-8"><p className="text-5xl">🙏</p><p className="mt-3 text-lg font-bold text-gray-900">Thank you!</p><p className="mt-1 text-sm text-gray-600">Your feedback helps us serve you better.</p></div>
      )}
      {valid && !done && (
        <div className="mt-6 w-full">
          <p className="text-lg font-bold text-gray-900">How was our service today?</p>
          {staff && <p className="mt-1 text-sm text-gray-600">You were served by {staff}.</p>}
          <div className="mt-5 flex justify-center gap-1" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? '' : 's'}`} onClick={() => setStars(n)}
                className={`text-5xl leading-none transition active:scale-90 ${n <= stars ? 'text-amber-400' : 'text-gray-300'}`}>★</button>
            ))}
          </div>
          <p className="mt-1 h-5 text-sm font-semibold text-gray-700">{WORDS[stars]}</p>
          {stars > 0 && (<>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} maxLength={300} placeholder={stars <= 3 ? 'What could we do better? (optional)' : 'Anything you would like to say? (optional)'}
              className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-sm" />
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <button type="button" disabled={busy} onClick={() => void send()} className="mt-3 w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Sending…' : 'Send my rating'}</button>
          </>)}
        </div>
      )}
    </main>
  )
}
