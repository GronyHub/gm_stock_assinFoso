'use client'
import { useEffect, useState } from 'react'

type Item = { id: number; code: string | null; title: string | null; violation: string }
const SNOOZE = 'lawReminderSnoozeUntil'

// Standing orders as reminders: the ones needed before work starts show after login; the ones about selling show after the person's first sale
// of the day. Each one is ticked to confirm they agree; the Daily Checklist shows who has confirmed.
export default function LawReminder() {
  const [data, setData] = useState<{ stage: 'login' | 'first_sale'; laws: Item[] } | null>(null)
  const [ticked, setTicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (window.location.pathname.startsWith('/login')) return
    let live = true
    const check = () => {
      let until = 0
      try { until = Number(localStorage.getItem(SNOOZE) ?? 0) } catch { /* private mode */ }
      if (Date.now() < until) return
      fetch('/api/law-reminders', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d?.stage && d.laws?.length) setData(d) }).catch(() => {})
    }
    check()
    const t = setInterval(check, 3 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  if (!data) return null
  const all = ticked.size === data.laws.length
  async function confirm() {
    if (!data) return
    setBusy(true)
    await fetch('/api/law-reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: data.laws.map(l => l.id) }) }).catch(() => {})
    setBusy(false); setData(null); setTicked(new Set())
  }
  function later() { try { localStorage.setItem(SNOOZE, String(Date.now() + 10 * 60 * 1000)) } catch { /* ignore */ } setData(null) }
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 sm:items-center print:hidden">
      <div className="max-h-[92vh] w-full max-w-lg space-y-2 overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 sm:rounded-3xl">
        <p className="text-base font-extrabold text-[#14213D]">{data.stage === 'login' ? '☀️ Before you start work' : '🛒 After your first sale'}</p>
        <p className="text-xs text-gray-600">{data.stage === 'login' ? 'Read each company law below and tick it to confirm you agree to follow it today.' : 'These laws are about selling. Tick each one to confirm you will follow it.'}</p>
        <div className="space-y-1.5">{data.laws.map(l => (
          <label key={l.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-2 ${ticked.has(l.id) ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
            <input type="checkbox" checked={ticked.has(l.id)} onChange={() => setTicked(t => { const n = new Set(t); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n })} className="mt-1 h-5 w-5" />
            <span className="text-sm"><b className="text-[#14213D]">{l.code} {l.title}</b>{l.violation && <span className="block text-[11px] text-red-700">A violation is: {l.violation}</span>}</span>
          </label>))}</div>
        <p className="text-[11px] text-gray-600">{data.stage === 'login' ? <>Then open your <a href="/standards" className="font-bold text-blue-700 underline">Daily Checklist</a> to see what to do and when. Read the full laws, with the video, in <a href="/laws" className="font-bold text-blue-700 underline">Company Laws</a>.</> : <>Read the full laws, with the video, in <a href="/laws" className="font-bold text-blue-700 underline">Company Laws</a>.</>}</p>
        <button type="button" disabled={!all || busy} onClick={() => void confirm()} className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">I confirm and agree to follow these</button>
        <button type="button" onClick={later} className="w-full rounded-xl bg-gray-100 py-2 text-xs font-bold text-gray-600">Remind me in 10 minutes</button>
      </div>
    </div>
  )
}
