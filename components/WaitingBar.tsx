'use client'
import { useEffect, useState } from 'react'
import SnoozeChips from '@/components/SnoozeChips'
import { isSnoozed } from '@/lib/snooze'

const KEY = 'waitingBarSnooze'
// The ONE reminder that something is waiting (laws to sign, clock times, CCTV reviews, approvals, questions...). It is a small bar, never a pop-up over the work,
// and "Open" goes to "Waiting for me", where each thing is done. It can be put off from 30 minutes to 12 hours.
export default function WaitingBar() {
  const [total, setTotal] = useState(0)
  const [now, setNow] = useState(0)
  const [later, setLater] = useState(false)
  const [choose, setChoose] = useState(false)
  useEffect(() => {
    if (window.location.pathname.startsWith('/login')) return
    let live = true
    const load = () => fetch('/api/my-day?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live && d) { setTotal(Number(d.total ?? 0)); setNow(Number(d.now ?? 0)) } }).catch(() => {})
    const tick = () => setLater(isSnoozed(KEY))
    load(); tick()
    const a = setInterval(load, 5 * 60 * 1000), b = setInterval(tick, 60000)
    return () => { live = false; clearInterval(a); clearInterval(b) }
  }, [])
  function open() {
    const ev = { path: '/my-day', handled: false }
    window.dispatchEvent(new CustomEvent('hub-open', { detail: ev }))
    if (!ev.handled) window.location.href = '/item?open=' + encodeURIComponent('/my-day')
  }
  if (total <= 0 || later) return null
  return (
    <div className="fixed bottom-3 left-20 right-0 z-[60] flex justify-center px-3 sm:left-24 print:hidden">
      <div className={`w-full max-w-sm rounded-xl border bg-white p-2.5 shadow-xl ${now ? 'border-red-300' : 'border-amber-300'}`}>
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 text-sm font-bold text-gray-900">📋 {total} thing{total === 1 ? '' : 's'} waiting for you{now ? <span className="text-red-700"> ({now} urgent)</span> : null}</p>
          <button type="button" onClick={open} className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Open</button>
          <button type="button" onClick={() => setChoose(c => !c)} className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-700">Later</button>
        </div>
        {choose && <div className="mt-2"><SnoozeChips storageKey={KEY} title="Remind me in" onDone={() => { setLater(true); setChoose(false) }} /></div>}
      </div>
    </div>
  )
}
