'use client'
import { useEffect, useState } from 'react'
import { quizOfDay } from '@/lib/serviceQuiz'
import { ruleOfDay } from '@/lib/customerServiceCode'
import { isSnoozed, snooze } from '@/lib/snooze'

// Start-of-day customer service card: today's rule, "is your tag on?", and one scenario question.
// Shown once per day per person on the first page they open; after it is answered it does not come back until tomorrow.
export default function ServiceDailyCard() {
  const [day, setDay] = useState<string | null>(null)
  const [tag, setTag] = useState(false)
  const [pick, setPick] = useState<number | null>(null)
  const [res, setRes] = useState<{ correct: boolean; right: number; why: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    let live = true
    fetch('/api/customer-service/daily').then(r => r.ok ? r.json() : null).then(d => {
      if (live && d && !d.skip && !d.done && !isSnoozed('serviceCardSnooze')) setDay(d.day)
    }).catch(() => {})
    return () => { live = false }
  }, [])

  if (!day || closed) return null
  const q = quizOfDay(day); const rule = ruleOfDay(day)

  async function submit() {
    if (pick == null) return
    setBusy(true)
    const r = await fetch('/api/customer-service/daily', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tagWorn: tag, answer: pick }) })
    const d = await r.json().catch(() => null)
    setBusy(false)
    if (r.ok && d) setRes(d); else setClosed(true)
  }

  return (
    <div className="fixed inset-0 z-[290] bg-black/60 flex items-center justify-center p-3 print:hidden">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto">
        <div className="bg-[#010745] text-white px-4 py-3 rounded-t-2xl">
          <p className="text-[10px] font-bold uppercase tracking-wider text-yellow-300">Customer service · today</p>
          <p className="text-base font-bold">Start your day the Grony way</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="rounded-xl bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-[10px] font-bold uppercase text-yellow-700">Rule of the day · {rule.code}</p>
            <p className="text-sm text-gray-900 mt-1">{rule.title && <b>{rule.title} </b>}{rule.text}</p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 cursor-pointer">
            <input type="checkbox" checked={tag} onChange={e => setTag(e.target.checked)} disabled={!!res} className="w-5 h-5 accent-green-600" />
            <span className="text-sm font-semibold text-gray-800">My employee tag is on</span>
          </label>

          <div>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Today&apos;s question</p>
            <p className="text-sm font-semibold text-gray-900 mb-2">{q.scenario} What do you do?</p>
            <div className="space-y-1.5">
              {q.options.map((o, i) => {
                const chosen = pick === i
                const show = res != null
                const cls = show
                  ? (i === res!.right ? 'border-green-500 bg-green-50' : chosen ? 'border-red-400 bg-red-50' : 'border-gray-200 opacity-60')
                  : (chosen ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50')
                return (
                  <button key={i} type="button" disabled={show} onClick={() => setPick(i)}
                    className={`w-full text-left text-sm rounded-xl border px-3 py-2.5 transition ${cls}`}>{o}</button>
                )
              })}
            </div>
          </div>

          {res ? (
            <div className="space-y-3">
              <div className={`rounded-xl px-3 py-2.5 text-sm ${res.correct ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                <b>{res.correct ? 'Correct. ' : 'Not quite. '}</b>{res.why}
              </div>
              <button type="button" onClick={() => setClosed(true)}
                className="w-full rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold py-3 text-base">Start work</button>
            </div>
          ) : (
            <button type="button" disabled={pick == null || busy} onClick={() => void submit()}
              className="w-full rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white font-bold py-3 text-base">
              {busy ? 'Saving…' : 'Submit answer'}
            </button>
          )}
          {!res && <button type="button" onClick={() => { snooze('serviceCardSnooze', 30); setClosed(true) }} className="w-full rounded-xl bg-gray-100 py-2 text-xs font-bold text-gray-600">Later: remind me in 30 minutes</button>}
        </div>
      </div>
    </div>
  )
}
