'use client'
import { useEffect, useState } from 'react'

// On To do every day, for every logged-in staff member: how many jobs customers have left, how many are ready to collect, how many are overdue.
export default function PendingJobsDue() {
  const [c, setC] = useState<{ open: number; ready: number; overdue: number } | null>(null)
  useEffect(() => { fetch('/api/pending-jobs?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setC).catch(() => {}) }, [])
  if (!c) return null
  const open = () => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path: '/pending-jobs' }, window.location.origin); else window.location.href = '/pending-jobs' }
  return (
    <button type="button" onClick={open} className={`mb-2 flex w-full items-center gap-2 rounded-xl border-2 p-2 text-left ${c.overdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
      <span className="text-xl">🧾</span>
      <span className="flex-1 text-sm font-bold text-gray-900">Pending jobs: {c.open} open{c.ready ? `, ${c.ready} ready to collect` : ''}{c.overdue ? <span className="text-red-700">, {c.overdue} overdue</span> : ''}</span>
      <span className="rounded-lg bg-[#14213D] px-3 py-1 text-xs font-bold text-white">Open</span>
    </button>
  )
}
