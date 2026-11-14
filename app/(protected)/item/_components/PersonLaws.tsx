'use client'
import { useEffect, useState } from 'react'

type L = { id: number; code: string | null; title: string; category: string | null }
type Data = { staff: string; laws: L[] }

// The laws in force for one person, by category. Nobody signs them and the per-law quizzes were dropped;
// each law's video and the daily law question are on the Laws page.
export default function PersonLaws({ staff }: { staff: string }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    setD(null); setErr('')
    fetch(`/api/law-record?staff=${encodeURIComponent(staff)}`, { cache: 'no-store' }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load'); setD(j) }).catch(e => setErr(e.message))
  }, [staff])
  if (err) return <p className="p-3 text-sm text-red-600">{err}</p>
  if (!d) return <p className="p-3 text-sm text-gray-400">Loading…</p>
  const byCat = new Map<string, L[]>()
  for (const l of d.laws) { const k = l.category ?? 'Other'; if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(l) }
  return (
    <div className="space-y-3 p-2">
      <p className="rounded-xl bg-gray-50 p-2 text-[11px] font-semibold text-gray-700">{d.laws.length} laws are in force for everyone; nobody signs them.</p>
      {Array.from(byCat.entries()).map(([cat, list]) => (
        <div key={cat}>
          <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{cat}</p>
          <div className="space-y-1">{list.map(l => (
            <div key={l.id} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs">
              <p className="font-semibold text-gray-900">{l.code ? <b>{l.code} </b> : null}{l.title}</p>
            </div>))}</div>
        </div>))}
    </div>
  )
}
