'use client'
import { useEffect, useState } from 'react'
import WithMic from '@/components/WithMic'

type Prev = { date: string; in: string }
type Auto = { id: number; date: string; out: string; basis: string }
type InN = { id: number; date: string; time: string; basis: string }
type Q = { id: number; from_user: string; about: string; work_date: string }

// The clock matters and questions that used to be separate pop-ups, now cards on "Waiting for me": enter a missing time out, check a clock-in or clock-out that
// was set for you (OK, or send the correct time), and answer a supervisor's question. Nothing here covers the screen.
export default function ClockNotices({ onChange }: { onChange?: () => void }) {
  const [prev, setPrev] = useState<Prev[]>([]); const [autos, setAutos] = useState<Auto[]>([]); const [ins, setIns] = useState<InN[]>([]); const [qs, setQs] = useState<Q[]>([])
  const [times, setTimes] = useState<Record<string, string>>({}); const [ans, setAns] = useState<Record<number, string>>({})
  const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => {
    fetch('/api/clock/open-check', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setPrev(d.previous ?? []); setAutos(d.autos ?? []); setIns(d.ins ?? []) } }).catch(() => {})
    fetch('/api/staff-queries', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setQs(d.queries ?? []) }).catch(() => {})
  }
  useEffect(() => { load() }, [])
  async function post(url: string, body: object) {
    setBusy(true); setMsg('')
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not save. Try again.'); return false }
    load(); onChange?.(); return true
  }
  const act = (b: object) => post('/api/clock/open-check', b)
  const card = 'space-y-2 rounded-2xl border-2 border-red-300 bg-red-50 p-3'
  const timeIn = (k: string) => <input type="time" value={times[k] ?? ''} onChange={e => setTimes(t => ({ ...t, [k]: e.target.value }))} className="w-full rounded-lg border-2 border-gray-300 bg-white p-2 text-lg" />
  return (<>
    {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
    {prev.length > 0 && (
      <div className={card}>
        <p className="text-sm font-extrabold text-red-800">🕐 You did not clock out</p>
        <p className="text-xs text-gray-700">Enter the time you left on each day. It is approved by your supervisor. Until then the app uses your last shop activity.</p>
        {prev.map(p => (<div key={p.date} className="space-y-1 rounded-xl bg-white p-2">
          <p className="text-sm font-bold text-gray-900">{p.date} <span className="font-normal text-gray-600">(clocked in {p.in})</span></p>
          {timeIn('p' + p.date)}
          <button type="button" disabled={!times['p' + p.date] || busy} onClick={() => void act({ action: 'enter', date: p.date, time: times['p' + p.date] })} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send time out for {p.date}</button>
        </div>))}
      </div>)}
    {autos.length > 0 && (
      <div className={card}>
        <p className="text-sm font-extrabold text-red-800">🕐 A clock-out was set for you</p>
        {autos.map(a => (<div key={a.id} className="space-y-1 rounded-xl bg-white p-2">
          <p className="text-sm font-bold text-gray-900">{a.date}: out at {a.out}</p>
          {a.basis && a.basis !== 'your last action at the shop in the app' && <p className="text-xs text-gray-700">{a.basis}</p>}
          <button type="button" disabled={busy} onClick={() => void act({ action: 'auto_ok', id: a.id })} className="w-full rounded-lg bg-green-600 py-2 text-sm font-bold text-white">OK, that is right</button>
          {timeIn('a' + a.date)}
          <button type="button" disabled={!times['a' + a.date] || busy} onClick={() => void act({ action: 'enter', date: a.date, time: times['a' + a.date] })} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send my correct time for approval</button>
        </div>))}
      </div>)}
    {ins.length > 0 && (
      <div className={card}>
        <p className="text-sm font-extrabold text-red-800">🕐 You were clocked in</p>
        {ins.map(a => (<div key={a.id} className="space-y-1 rounded-xl bg-white p-2">
          <p className="text-sm font-bold text-gray-900">{a.date}: in at {a.time}</p>
          {a.basis && <p className="text-xs text-gray-700">{a.basis}</p>}
          <button type="button" disabled={busy} onClick={() => void act({ action: 'in_ok', id: a.id })} className="w-full rounded-lg bg-green-600 py-2 text-sm font-bold text-white">OK, that is right</button>
          {timeIn('i' + a.date)}
          <button type="button" disabled={!times['i' + a.date] || busy} onClick={() => void act({ action: 'enter_in', date: a.date, time: times['i' + a.date] })} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send my correct time for approval</button>
        </div>))}
      </div>)}
    {qs.length > 0 && (
      <div className={card}>
        <p className="text-sm font-extrabold text-red-800">❓ Questions for you</p>
        {qs.map(q => (<div key={q.id} className="space-y-1 rounded-xl bg-white p-2">
          <p className="text-sm text-gray-900"><b>{q.from_user}</b> asks about {q.work_date}: {q.about}</p>
          <WithMic onText={t => setAns(x => ({ ...x, [q.id]: ((x[q.id] ?? '') + ' ' + t).trim() }))}>
            <textarea value={ans[q.id] ?? ''} onChange={e => setAns(x => ({ ...x, [q.id]: e.target.value }))} rows={2} placeholder="Your answer" className="w-full rounded-lg border-2 border-gray-300 p-2 text-sm" />
          </WithMic>
          <button type="button" disabled={(ans[q.id] ?? '').trim().length < 3 || busy} onClick={() => void post('/api/staff-queries', { id: q.id, answer: ans[q.id] })} className="w-full rounded-lg bg-[#14213D] py-2 text-sm font-bold text-white disabled:opacity-40">Send my answer</button>
        </div>))}
      </div>)}
  </>)
}
