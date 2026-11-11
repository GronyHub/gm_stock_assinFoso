'use client'
import { useEffect, useState } from 'react'
import type { MyDayItem } from '@/lib/myDay'
import ClockNotices from '@/components/ClockNotices'
import PenaltyDecisions from '@/components/PenaltyDecisions'
import ClockApprovals from '@/components/ClockApprovals'

// These are answered right here on cards (see components/ClockNotices.tsx), so they are not repeated in the list below.
const INLINE = new Set(['clock-prev', 'clock-auto', 'queries', 'sanctions', 'violations', 'claims', 'cctv'])

const TONE = { now: 'border-red-300 bg-red-50', soon: 'border-amber-300 bg-amber-50', later: 'border-gray-200 bg-white' } as const
const TAG = { now: 'Now', soon: 'Today', later: 'When you can' } as const

// Waiting for me: everything the signed-in person owes or must decide, from every part of the app, most urgent first.
export default function MyDayClient({ onNavigate }: { onNavigate?: (i: MyDayItem) => void } = {}) {
  const [items, setItems] = useState<MyDayItem[] | null>(null)
  // Supervisors can look at a team member's list (read-only) and send a reminder. `who` is empty for my own list.
  const [people, setPeople] = useState<string[]>([])
  const [who, setWho] = useState('')
  const [msg, setMsg] = useState('')
  const load = (w = who) => fetch('/api/my-day' + (w ? `?for=${encodeURIComponent(w)}` : ''), { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setItems(d?.items ?? [])).catch(() => setItems([]))
  useEffect(() => { void load() }, [])
  useEffect(() => { fetch('/api/my-day?people=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPeople(d?.people ?? [])).catch(() => {}) }, [])
  const pick = (w: string) => { setWho(w); setItems(null); setMsg(''); void load(w) }
  async function remind() {
    const r = await fetch('/api/my-day/remind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: who }) })
    const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? (j.message ?? 'Reminder sent.') : (j.error ?? 'Could not send.')); setTimeout(() => setMsg(''), 4000)
  }
  const go = (i: MyDayItem) => { if (onNavigate) { onNavigate(i); return } if (i.hub) window.parent.postMessage({ type: 'open-personal', tab: i.hub }, window.location.origin); else if (i.href) window.location.href = i.href }
  const hidden = who ? new Set<string>() : INLINE
  const shown = items?.filter(i => !hidden.has(i.key)) ?? []
  const waiting = shown.filter(i => i.urgency !== 'later').reduce((n, i) => n + i.count, 0)
  const overdue = shown.filter(i => i.urgency === 'now').reduce((n, i) => n + i.count, 0)
  const name = who ? who.charAt(0).toUpperCase() + who.slice(1) : ''
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#14213D]">{who ? `${name}'s list` : 'Waiting for me'}</h1>
        <button type="button" onClick={() => void load()} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">Refresh</button>
      </div>
      {people.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {['', ...people].map(p => <button key={p || 'me'} type="button" onClick={() => pick(p)} className={`rounded-full px-3 py-1 text-xs font-bold ${who === p ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Me'}</button>)}
        </div>
      )}
      {who ? (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-2 text-xs font-semibold text-blue-900">
          <span className="min-w-0 flex-1">You are looking at {name}'s list. You can see it but not act on it. {items ? `${waiting} waiting${overdue ? `, ${overdue} overdue` : ''}.` : ''}</span>
          <button type="button" onClick={() => void remind()} className="shrink-0 rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">Remind {name}</button>
        </div>
      ) : (<p className="text-sm text-gray-700">Everything you owe or must decide, from every part of the app, most urgent first.{items ? ` ${waiting} waiting${overdue ? `, ${overdue} overdue` : ''}.` : ''}</p>)}
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {!who && <ClockNotices onChange={() => void load()} />}
      {!who && <ClockApprovals />}
      {!who && <PenaltyDecisions onChange={() => void load()} />}
      {items === null && <p className="text-sm text-gray-500">Loading…</p>}
      {items && !shown.length && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">✅ Nothing is waiting{who ? ` for ${name}` : ' for you'}.</p>}
      {shown.map(i => (
        <div key={i.key} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${TONE[i.urgency]}`}>
          <span className="text-2xl">{i.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-900">{i.title} {i.count > 1 && <span className="ml-1 rounded-full bg-[#14213D] px-2 py-0.5 text-[10px] font-bold text-white">{i.count}</span>} <span className="ml-1 text-[10px] font-bold uppercase text-gray-500">{TAG[i.urgency]}</span></p>
            <p className="text-xs text-gray-700">{i.detail}</p>
          </div>
          {!who && (i.href || i.hub) && <button type="button" onClick={() => go(i)} className="shrink-0 rounded-xl bg-[#14213D] px-3 py-2 text-xs font-bold text-white">{i.key.startsWith('task-') ? 'Do it' : 'Open'}</button>}
        </div>))}
    </div>
  )
}
