'use client'
import { useEffect, useState } from 'react'

// On the team To do: the CCTV reviews waiting to be done (Joe's, within 48 hours). The review itself is each reviewer's own duty, so it is also a row in their Waiting for me.
export default function CctvDue() {
  const [n, setN] = useState(0)
  useEffect(() => { fetch('/api/cctv-review?summary=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setN(Number(d?.pending || d?.all || 0))).catch(() => {}) }, [])
  if (n <= 0) return null
  return (
    <a href="/cctv-review" className="mb-2 flex items-center gap-2 rounded-xl border-2 border-red-300 bg-red-50 p-2 text-sm font-bold text-red-800">
      <span className="text-xl">🎥</span><span className="flex-1">{n} CCTV review{n === 1 ? '' : 's'} waiting · Joe · within 48 hours</span><span className="rounded-lg bg-red-600 px-3 py-1 text-xs text-white">Open</span>
    </a>
  )
}
