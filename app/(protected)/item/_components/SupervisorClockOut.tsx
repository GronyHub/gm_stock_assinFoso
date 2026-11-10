'use client'
import { useEffect, useState } from 'react'
import WithMic from '@/components/WithMic'

type Info = { can: boolean; open?: boolean; canIn?: boolean; date?: string; in?: string; lastActivity?: string | null; firstActivity?: string | null }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// Shown on a staff member's own page to their supervisor (the owner and Joe for anyone; Bino for James) while that person is clocked in with no time out.
// The supervisor must give their evidence that the person is not at the shop. They can enter the time the person left; if they do not know it, the app uses the
// person's last shop-only action. The person is then told and can tap OK or send a correction claim, decided by someone other than the supervisor.
export default function SupervisorClockOut({ staffName }: { staffName: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [time, setTime] = useState('')
  const [evidence, setEvidence] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const load = () => fetch(`/api/clock/supervisor-out?staff=${encodeURIComponent(staffName.toLowerCase())}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setInfo(d)).catch(() => {})
  useEffect(() => { setDone(''); setMsg(''); void load() }, [staffName]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!info?.can || (!info.open && !info.canIn && !done)) return null
  const clockIn = !info.open
  async function go() {
    setBusy(true); setMsg('')
    const r = await fetch(clockIn ? '/api/clock/supervisor-in' : '/api/clock/supervisor-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staff: staffName.toLowerCase(), evidence, time: time || undefined }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'Could not clock them out.'); return }
    setDone(clockIn ? `${cap(staffName)} is clocked in at ${d.in}. They have been told and can send a correction.` : `${cap(staffName)} is clocked out at ${d.out}. They have been told and can send a correction.`); void load()
  }
  if (done) return <p className="mx-3 mt-2 rounded-xl bg-green-50 p-2 text-xs font-bold text-green-800">{done}</p>
  return (
    <div className="mx-3 mt-2 space-y-1.5 rounded-xl border-2 border-amber-300 bg-amber-50 p-2.5">
      <p className="text-xs font-extrabold text-amber-900">{clockIn ? `${cap(staffName)} has not clocked in today. At the shop?` : `${cap(staffName)} is still clocked in (since ${info.in}). Not at the shop?`}</p>
      <WithMic onText={t => setEvidence(x => (x ? x + ' ' : '') + t)}>
        <textarea value={evidence} onChange={e => setEvidence(e.target.value)} rows={2} placeholder={clockIn ? 'Your evidence they are at the shop (CCTV, you saw them...)' : 'Your evidence they are not at the shop (CCTV, a call, a photo...)'} className="w-full rounded-lg border border-amber-300 bg-white p-2 text-xs" />
      </WithMic>
      <label className="block text-[11px] font-bold text-gray-700">{clockIn ? 'Time they arrived' : 'Time they left'} (leave empty if you do not know)
        <input type="time" value={time} onChange={e => setTime(e.target.value)} className="mt-0.5 w-full rounded-lg border border-amber-300 bg-white p-1.5 text-sm" /></label>
      {!time && <p className="text-[11px] text-gray-700">{clockIn ? (info.firstActivity ? `Without a time, the app uses their first action at the shop today: ${info.firstActivity}.` : 'They have no shop activity today, so you must enter the time they arrived.') : (info.lastActivity ? `Without a time, the app uses their last action at the shop: ${info.lastActivity}.` : 'They have no shop activity today, so you must enter the time they left.')}</p>}
      {msg && <p className="text-xs font-bold text-red-700">{msg}</p>}
      <button type="button" disabled={busy || evidence.trim().length < 4 || (!time && !(clockIn ? info.firstActivity : info.lastActivity))} onClick={() => void go()} className="w-full rounded-xl bg-amber-600 py-2 text-xs font-bold text-white disabled:opacity-40">Clock {cap(staffName)} {clockIn ? 'in' : 'out'}</button>
    </div>
  )
}
