'use client'
import { useEffect, useState } from 'react'

// "You: 12 of 30 this week": the signed-in person's progress against the weekly counts law (Monday to Sunday).
export default function CountWeek() {
  const [d, setD] = useState<{ mine: number; target: number; started: boolean; weekEnd: string } | null>(null)
  useEffect(() => { fetch('/api/stock/week', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(x => x && setD(x)).catch(() => {}) }, [])
  if (!d) return null
  const pct = Math.min(100, Math.round((d.mine / d.target) * 100))
  return (
    <div className="min-w-[180px] flex-1">
      <p className="text-[12px] font-bold text-gray-800">You: {d.mine} of {d.target} items this week{d.started ? '' : ' · counts from Mon 23 Nov'}</p>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200"><div className={`h-full rounded-full ${d.mine >= d.target ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}
