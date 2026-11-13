'use client'
import { useEffect, useState } from 'react'

type P = { needed: number; fixed: number; negOpen: number; negFixed: number; open: number }
// The daily flags law on the Flags page: how many are fixed today against the 5 needed, and the negative stock still open.
export default function FlagQuotaLine() {
  const [p, setP] = useState<P | null>(null)
  useEffect(() => { fetch('/api/flags/quota', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setP(d?.progress ?? null)).catch(() => {}) }, [])
  if (!p) return null
  const ok = p.fixed >= p.needed
  return (
    <p className={`mb-2 rounded-lg p-2 text-sm font-bold ${ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
      Today: {p.fixed} of {p.needed} flags fixed{ok ? ' ✓' : ''}. {p.negOpen > 0 ? `Negative stock still open: ${p.negOpen}.` : 'No negative stock left.'}
      <span className="block text-[11px] font-semibold opacity-80">Law: the manager fixes at least 5 flags a day, starting with the negative stock. Fewer costs 1 penalty point at 19:25.</span>
    </p>
  )
}
