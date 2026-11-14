'use client'
import { useEffect, useState } from 'react'
import { useFeatures } from '@/lib/useFeatures'

type Q = { lawId: number; law: string | null; q: string; options: string[] }
type R = { correct: boolean; right: string; why: string | null; law: string | null; text: string | null; video: { key: string; label: string; src: string } | null }

// The question of the day: one question from the laws, at the bottom of the screen (it never covers the page). A wrong answer shows the right one and the law.
export default function LawQuestion() {
  const features = useFeatures()   // Settings > Switches
  const [q, setQ] = useState<Q | null>(null)
  const [r, setR] = useState<R | null>(null)
  const [busy, setBusy] = useState(false)
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (window.location.pathname.startsWith('/login')) return
    const t = setTimeout(() => { fetch('/api/law-question', { cache: 'no-store' }).then(x => x.ok ? x.json() : null).then(d => setQ(d?.question ?? null)).catch(() => {}) }, 20000)   // after the login reminders
    return () => clearTimeout(t)
  }, [])
  if (!q) return null
  if (!features.law_question) return null
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/start-of-day')) return null   // never cover the manager's "Before you continue" page
  async function answer(i: number) {
    setBusy(true)
    const x = await fetch('/api/law-question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: i }) })
    const d = await x.json().catch(() => null)
    setBusy(false)
    if (d) setR(d)
  }
  return (
    <div className="fixed inset-x-2 bottom-2 z-[85] mx-auto max-w-md space-y-2 rounded-2xl border-2 border-indigo-300 bg-white p-3 shadow-xl print:hidden">
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-indigo-700">Question of the day{q.law ? ` · ${q.law}` : ''}</p>
      <p className="text-sm font-bold text-gray-900">{q.q}</p>
      {!r && <div className="space-y-1.5">{q.options.map((o, i) => <button key={i} type="button" disabled={busy} onClick={() => void answer(i)} className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-left text-sm text-gray-900 disabled:opacity-40">{o}</button>)}</div>}
      {r && (<div className={`space-y-1 rounded-lg p-2 text-sm ${r.correct ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}>
        <p className="font-bold">{r.correct ? 'Right.' : `Not quite. The answer is: ${r.right}`}</p>
        {r.why && <p>{r.why}</p>}
        {!r.correct && r.text && <p className="text-[12px] text-gray-800"><b>The law:</b> {r.text}</p>}
        {!r.correct && r.video && !play && <button type="button" onClick={() => setPlay(true)} className="mr-3 rounded-lg bg-indigo-600 px-2.5 py-1 text-[12px] font-bold text-white">▶ Watch the {r.video.label} video</button>}
        {play && r.video && <video src={r.video.src} autoPlay controls playsInline className="max-h-[45vh] w-full rounded-lg bg-black"
          onEnded={() => void fetch('/api/law-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area: r.video!.key, label: r.video!.label + ' video' }) }).catch(() => {})} />}
        <a href={`/laws?law=${q.lawId}`} className="text-[12px] font-bold text-blue-700 underline">Open the law</a>
      </div>)}
      {r && <button type="button" onClick={() => setQ(null)} className="w-full rounded-xl bg-[#14213D] py-2 text-sm font-bold text-white">OK</button>}
    </div>
  )
}
