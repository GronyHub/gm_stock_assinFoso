'use client'
import SnoozeChips from '@/components/SnoozeChips'
import { useEffect, useState } from 'react'
import LawLink from '@/components/LawLink'
import { isSnoozed } from '@/lib/snooze'

type Prev = { date: string; in: string }
type Auto = { id: number; date: string; out: string; basis: string }
type State = { askNow: boolean; previous: Prev[]; autos: Auto[] }

// 1) Before work the next day: every earlier day left open must have its time out entered (non-owners' entries go to Grony and Joe to approve).
// 2) From 7pm: "Are you still at the shop?" -- no logs them out at the time of their last activity and lets them send the correct time.
export default function ClockOutPrompt() {
  const [st, setSt] = useState<State | null>(null)
  const [times, setTimes] = useState<Record<string, string>>({})
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [fix, setFix] = useState<{ date: string; out: string } | null>(null)
  const [fixTime, setFixTime] = useState('')
  const [later, setLater] = useState(false)
  const [tick, setTick] = useState(0) // re-reads the put-off times
  useEffect(() => { const f = () => { try { setLater(Date.now() < Number(localStorage.getItem('clockAutoSnooze') ?? 0)); setTick(t => t + 1) } catch { /* ignore */ } }; f(); const t = setInterval(f, 60000); return () => clearInterval(t) }, [])
  const load = () => fetch('/api/clock/open-check', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setSt({ askNow: !!d.askNow, previous: d.previous ?? [], autos: d.autos ?? [] }) }).catch(() => {})
  useEffect(() => {
    if (window.location.pathname.startsWith('/login')) return
    void load()
    const t = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])
  async function post(body: object) {
    setBusy(true); setMsg('')
    const r = await fetch('/api/clock/open-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not save. Try again.'); return null }
    return d.data ?? d
  }
  if (fix) return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 sm:items-center print:hidden">
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-[#14213D]">You are logged out at {fix.out}</p>
        <p className="text-sm text-gray-700">That is the time of your last activity in the app. If you really left at a different time, enter it. Grony and Joe will approve it.</p>
        <input type="time" value={fixTime} onChange={e => setFixTime(e.target.value)} className="w-full rounded-xl border-2 border-gray-300 p-2 text-lg" />
        {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
        <LawLink name="Clock out when you leave" />
        <button type="button" disabled={!fixTime || busy} onClick={async () => { const d = await post({ action: 'enter', date: fix.date, time: fixTime }); if (d) { setFix(null); void load() } }} className="w-full rounded-xl bg-[#14213D] py-2.5 text-sm font-bold text-white disabled:opacity-40">Send my time for approval</button>
        <button type="button" onClick={() => { setFix(null); void load() }} className="w-full rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700">That time is correct</button>
      </div>
    </div>
  )
  void tick
  if (!st) return null
  if (st.previous.length && !isSnoozed('clockPrevSnooze')) return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/70 sm:items-center print:hidden">
      <div className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-red-700">You did not clock out</p>
        <p className="text-sm text-gray-700">Enter the time you left on each day below before you carry on. Grony and Joe will approve it. Until then the app uses your last activity.</p>
        {st.previous.map(p => (
          <div key={p.date} className="space-y-1 rounded-xl bg-gray-50 p-2">
            <p className="text-sm font-bold text-gray-900">{p.date} <span className="font-normal text-gray-600">(you clocked in at {p.in})</span></p>
            <input type="time" value={times[p.date] ?? ''} onChange={e => setTimes(t => ({ ...t, [p.date]: e.target.value }))} className="w-full rounded-lg border-2 border-gray-300 p-2 text-lg" />
            <button type="button" disabled={!times[p.date] || busy} onClick={async () => { const d = await post({ action: 'enter', date: p.date, time: times[p.date] }); if (d) void load() }} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send time out for {p.date}</button>
          </div>))}
        <LawLink name="Clock out when you leave" />
        <SnoozeChips storageKey="clockPrevSnooze" title="Later: remind me in" onDone={() => setTick(t => t + 1)} />
        {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
      </div>
    </div>
  )
  if (st.autos.length && !later) return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 sm:items-center print:hidden">
      <div className="max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-[#14213D]">We clocked you out</p>
        <p className="text-sm text-gray-700">You did not clock out, so the app did it for you at the time of your last action at the shop. Tap OK if the time is right. If not, send the correct time and Grony or Joe will approve it.</p>
        {st.autos.map(a => (
          <div key={a.id} className="space-y-2 rounded-xl bg-gray-50 p-2">
            <p className="text-sm font-bold text-gray-900">{a.date}: out at {a.out}</p>
            <button type="button" disabled={busy} onClick={async () => { const d = await post({ action: 'auto_ok', id: a.id }); if (d) void load() }} className="w-full rounded-lg bg-green-600 py-2 text-sm font-bold text-white">OK, that is right</button>
            <input type="time" value={times[a.date] ?? ''} onChange={e => setTimes(t => ({ ...t, [a.date]: e.target.value }))} className="w-full rounded-lg border-2 border-gray-300 p-2 text-lg" />
            <button type="button" disabled={!times[a.date] || busy} onClick={async () => { const d = await post({ action: 'enter', date: a.date, time: times[a.date] }); if (d) void load() }} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send my correct time for approval</button>
          </div>))}
        <LawLink name="Clock out when you leave" />
        <SnoozeChips storageKey="clockAutoSnooze" title="Remind me later in" onDone={() => setLater(true)} />
        {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
      </div>
    </div>
  )
  if (st.askNow && !isSnoozed('clockAskSnooze')) return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 sm:items-center print:hidden">
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-[#14213D]">Are you still at the shop?</p>
        <p className="text-sm text-gray-700">It is past 7pm and you have not clocked out.</p>
        {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
        <LawLink name="Clock out when you leave" />
        <SnoozeChips storageKey="clockAskSnooze" title="Ask me later in" onDone={() => setTick(t => t + 1)} />
        <button type="button" disabled={busy} onClick={async () => { const d = await post({ action: 'still_here' }); if (d) void load() }} className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white">Yes, I am still here</button>
        <button type="button" disabled={busy} onClick={async () => { const d = await post({ action: 'left' }); if (d) { setFix({ date: new Date().toISOString().slice(0, 10), out: d.out }); setFixTime('') } }} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">No, I have left</button>
      </div>
    </div>
  )
  return null
}
