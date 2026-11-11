'use client'
import { useEffect, useState } from 'react'

// A row among the day's tasks on the team To do: the CCTV reviews waiting to be done (Joe's, within 48 hours). The review itself is each reviewer's own duty, so it is also a row in their Waiting for me.
export default function CctvDue() {
  const [n, setN] = useState(0)
  useEffect(() => { fetch('/api/cctv-review?summary=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setN(Number(d?.pending || d?.all || 0))).catch(() => {}) }, [])
  if (n <= 0) return null
  return (
    <a href="/cctv-review" className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-2 py-1">
      <span className="text-lg leading-none">🎥</span><span className="shrink-0 text-[10px] font-bold text-gray-500">48h</span><span className="flex-1 text-[11px] font-semibold leading-tight text-gray-900">{n} CCTV review{n === 1 ? '' : 's'} to do<span className="ml-1 rounded bg-indigo-100 px-1 text-[10px] font-bold text-indigo-800">Joe</span></span><span className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Open</span>
    </a>
  )
}
