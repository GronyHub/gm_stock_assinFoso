'use client'
import { useEffect, useState } from 'react'

type Me = { n: number; avg: number | null; low: number; star: boolean; recent: { stars: number; comment: string | null; rated_at: string }[] }
const dlabel = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const stars = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

// The signed-in person's customer ratings, on the profile page.
export default function RatingsCard() {
  const [m, setM] = useState<Me | null>(null)
  useEffect(() => { fetch('/api/ratings/me').then(r => r.ok ? r.json() : null).then(setM).catch(() => {}) }, [])
  if (!m) return null
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><span className="text-xl font-extrabold leading-none">{m.avg != null ? m.avg.toFixed(1) : '–'}</span><span className="text-[9px] font-bold">of 5</span></div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Customer ratings {m.star && <span className="ml-1 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] font-extrabold text-[#14213D]">⭐ Service Star this week</span>}</p>
          <p className="text-[11px] text-gray-500">{m.n ? `${m.n} rating${m.n === 1 ? '' : 's'} in the last 30 days${m.low ? `, ${m.low} low` : ''}` : 'No ratings yet. Customers rate you from the link in their receipt message.'}</p>
        </div>
      </div>
      {m.recent.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-blue-700">What customers said</summary>
          <div className="mt-1 space-y-1">{m.recent.map((r, i) => <div key={i} className="rounded-lg bg-gray-50 px-2 py-1 text-[11px]"><span className="text-amber-500">{stars(r.stars)}</span> · {dlabel(r.rated_at)}{r.comment ? ` · "${r.comment}"` : ''}</div>)}</div>
        </details>
      )}
    </div>
  )
}
