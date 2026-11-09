'use client'
import { useEffect, useState } from 'react'

const SNOOZE_KEY = 'lawSignSnoozeUntil'
// A reminder, repeated through the day, while a staff member still has Company Laws to sign.
export default function LawSignPrompt() {
  const [n, setN] = useState(0)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (window.location.pathname.startsWith('/laws')) return
    let live = true
    const check = () => {
      let until = 0
      try { until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0) } catch { /* private mode */ }
      if (Date.now() < until) { setHidden(true); return }
      fetch('/api/law-signatures').then(r => r.ok ? r.json() : null).then(d => { if (live && d) { setN(d.unsigned ?? 0); setHidden(false) } }).catch(() => {})
    }
    check()
    const t = setInterval(check, 30 * 60 * 1000)
    return () => { live = false; clearInterval(t) }
  }, [])
  if (hidden || n <= 0) return null
  function later() { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 2 * 60 * 60 * 1000)) } catch { /* ignore */ } setHidden(true) }
  return (
    <div className="fixed inset-x-0 bottom-3 z-[60] flex justify-center px-3 print:hidden">
      <div className="w-full max-w-sm rounded-xl border border-amber-300 bg-white p-3 shadow-xl">
        <p className="text-sm font-bold text-gray-900">✍ {n} Company Law{n === 1 ? '' : 's'} to sign</p>
        <p className="mt-0.5 text-xs text-gray-600">Read each law and sign to show you understand it and will follow it.</p>
        <div className="mt-2 flex gap-2">
          <a href="/laws?sign=1" className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Read and sign</a>
          <button type="button" onClick={later} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">Remind me later</button>
        </div>
      </div>
    </div>
  )
}
