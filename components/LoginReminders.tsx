'use client'
import { useEffect, useState } from 'react'

type R = { key: string; tone: 'red' | 'amber' | 'blue'; title: string; text: string }
const TONE = { red: 'border-red-400 bg-red-50 text-red-900', amber: 'border-amber-400 bg-amber-50 text-amber-900', blue: 'border-blue-400 bg-blue-50 text-blue-900' }

// Each time someone logs in (once per browser session) the reminders flash on screen one after another, a few seconds each, then go. Tap one to dismiss it early.
export default function LoginReminders() {
  const [queue, setQueue] = useState<R[]>([])
  useEffect(() => {
    try { if (sessionStorage.getItem('login-reminders') === '1') return; sessionStorage.setItem('login-reminders', '1') } catch { /* private window: show anyway */ }
    fetch('/api/reminders/login', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (Array.isArray(d?.reminders)) setQueue(d.reminders) }).catch(() => {})
  }, [])
  const head = queue[0]
  useEffect(() => {
    if (!head) return
    const t = setTimeout(() => setQueue(q => q.slice(1)), 6500)
    return () => clearTimeout(t)
  }, [head])
  if (!head) return null
  return (
    <button type="button" onClick={() => setQueue(q => q.slice(1))} aria-live="polite"
      className={`fixed left-1/2 top-2 z-[70] w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border-2 px-3 py-2 text-left shadow-lg print:hidden ${TONE[head.tone]}`}>
      <span className="block text-[12px] font-extrabold leading-tight">{head.title}</span>
      <span className="block text-[12px] font-semibold leading-snug">{head.text}</span>
      {queue.length > 1 && <span className="mt-0.5 block text-[10px] font-bold opacity-60">{queue.length - 1} more</span>}
    </button>
  )
}
