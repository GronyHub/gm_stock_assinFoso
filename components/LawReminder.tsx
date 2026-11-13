'use client'
import SnoozeChips from '@/components/SnoozeChips'
import { useEffect, useState } from 'react'
import { useFeatures } from '@/lib/useFeatures'

type Item = { id: number; code: string | null; title: string | null; violation: string }
const SNOOZE = 'lawReminderSnoozeUntil'

// Standing orders as reminders: the ones needed before work starts show after login; the ones about selling show after the person's first sale
// of the day. The laws are statutory (nobody signs them): this is the moment they apply, and the tick only says they were read.
export default function LawReminder() {
  const features = useFeatures()   // Settings > Switches
  const [data, setData] = useState<{ stage: 'login' | 'first_sale' | 'midday'; laws: Item[] } | null>(null)
  const [agree, setAgree] = useState(false)
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
  if (!features.law_reminder) return null
  async function confirm() {
    if (!data) return
    setBusy(true)
    await fetch('/api/law-reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: data.laws.map(l => l.id), stage: data.stage }) }).catch(() => {})
    setBusy(false); setData(null); setAgree(false)
  }
  return (
    <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/50 sm:items-center print:hidden">
      <div className="max-h-[92vh] w-full max-w-lg space-y-2 overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 sm:rounded-3xl">
        <p className="text-base font-extrabold text-[#14213D]">{data.stage === 'login' ? '☀️ Before you start work' : data.stage === 'midday' ? '🕐 Mid-day reminder' : '🛒 After your first sale'}</p>
        <p className="text-xs text-gray-600">{data.stage === 'login' ? 'These laws apply to what you are about to do today. Read them, then tick.' : data.stage === 'midday' ? 'A reminder of the selling laws for the rest of the day. Tick once to agree to keep following all of them.' : 'These laws are about selling. Tick once to agree to follow all of them.'}</p>
        <ul className="space-y-1.5">{data.laws.map(l => (
          <li key={l.id} className="rounded-xl bg-gray-50 p-2 text-sm"><b className="text-[#14213D]">{l.code} {l.title}</b>{l.violation && <span className="block text-[11px] text-red-700">A violation is: {l.violation}</span>}</li>))}</ul>
        <label className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-2 ${agree ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
          <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5" />
          <span className="text-sm font-bold text-gray-900">I have read these laws.</span>
        </label>
        <p className="text-[11px] text-gray-600">{data.stage === 'login' ? <>Then open your <a href="/todo" className="font-bold text-blue-700 underline">Today list</a> to see what to do and when. Read the full laws, with the video, in <a href="/laws" className="font-bold text-blue-700 underline">Company Laws</a>.</> : <>Read the full laws, with the video, in <a href="/laws" className="font-bold text-blue-700 underline">Company Laws</a>.</>}</p>
        <button type="button" disabled={!agree || busy} onClick={() => void confirm()} className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Got it</button>
        <SnoozeChips storageKey={SNOOZE} title="Remind me in" onDone={() => setData(null)} />
      </div>
    </div>
  )
}
