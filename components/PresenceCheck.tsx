'use client'
import { useEffect, useRef, useState } from 'react'

type Check = { id: number; by: string; secondsLeft: number }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// After 18:00, when a colleague clocks out and says nobody else is at the shop, the people still clocked in get this prompt: confirm you are here within a minute, or be clocked out at
// your last action. It looks for a check every 15 seconds while the app is open and visible (after 18:00 only), and a push reaches a phone that is in a pocket.
export default function PresenceCheck() {
  const [check, setCheck] = useState<Check | null>(null)
  const [left, setLeft] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const ended = useRef(false)
  useEffect(() => {
    const look = () => {
      if (document.visibilityState !== 'visible' || new Date().getUTCHours() < 18) return
      fetch('/api/clock/presence', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
        const c: Check | null = d?.check ?? null
        if (c) { ended.current = false; setCheck(c); setLeft(c.secondsLeft) }
        else if (check && !ended.current) { ended.current = true; setCheck(null) }
      }).catch(() => {})
    }
    look()
    const t = setInterval(look, 15000)
    document.addEventListener('visibilitychange', look)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', look) }
  }, [check])
  useEffect(() => {
    if (!check) return
    const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [check])
  // When the minute is up, look once more: the server has clocked the person out (or not, if there was no activity to base a time on).
  useEffect(() => {
    if (!check || left > 0) return
    const t = setTimeout(() => { fetch('/api/clock/presence', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (!d?.check) { setMsg('You were clocked out because you did not confirm. Open Times to see your time.'); setCheck(null); setTimeout(() => setMsg(''), 12000) } }).catch(() => {}) }, 2500)
    return () => clearTimeout(t)
  }, [left, check])
  async function confirm() {
    if (!check) return
    setBusy(true)
    const r = await fetch('/api/clock/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'confirm', id: check.id }) })
    setBusy(false)
    if (r.ok) setCheck(null)
  }
  if (!check) return msg ? <div className="fixed inset-x-3 top-3 z-[95] rounded-xl border-2 border-red-400 bg-red-50 p-3 text-sm font-bold text-red-900 shadow-lg print:hidden">{msg}</div> : null
  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-black/60 sm:items-center print:hidden" role="alertdialog" aria-live="assertive">
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-red-700">{cap(check.by)} has said you are not at the shop</p>
        <p className="text-sm text-gray-800">Please confirm that you are still at the shop. If you do not confirm, you will be clocked out at the time of your last action in the app.</p>
        <p className={`text-center text-4xl font-black tabular-nums ${left <= 15 ? 'text-red-600' : 'text-[#14213D]'}`}>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</p>
        <button type="button" disabled={busy || left === 0} onClick={() => void confirm()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">I am still at the shop</button>
      </div>
    </div>
  )
}
