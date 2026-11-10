'use client'
import { useEffect, useState } from 'react'
import type { Check } from '@/lib/integrity'

const TONE = { ok: 'border-green-300 bg-green-50', warn: 'border-amber-300 bg-amber-50', bad: 'border-red-300 bg-red-50' } as const
const ICON = { ok: '✅', warn: '⚠️', bad: '🔴' } as const

// The system check for Joe and Grony: automatic checks for places where one part of the app does not agree with another.
export default function IntegrityClient() {
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [err, setErr] = useState('')
  const load = () => { setChecks(null); fetch('/api/integrity', { cache: 'no-store' }).then(r => r.json()).then(d => { if (d.checks) setChecks(d.checks); else setErr(d.error ?? 'Could not run the check.') }).catch(() => setErr('Could not run the check.')) }
  useEffect(() => { load() }, [])
  const problems = checks?.filter(c => c.status !== 'ok').length ?? 0
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3">
      <div className="flex items-center justify-between"><h1 className="text-xl font-extrabold text-[#14213D]">System check</h1>
        <button type="button" onClick={load} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">Run again</button></div>
      <p className="text-sm text-gray-700">Places where one part of the app does not agree with another. Each line says how many, gives examples, and opens where it is fixed.</p>
      {err && <p className="text-sm font-bold text-red-700">{err}</p>}
      {!checks && !err && <p className="text-sm text-gray-500">Checking…</p>}
      {checks && <p className={`rounded-xl p-2 text-sm font-bold ${problems ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-800'}`}>{problems ? `${problems} thing${problems === 1 ? '' : 's'} to look at.` : 'Everything agrees.'}</p>}
      {checks?.map(c => (
        <div key={c.key} className={`space-y-1 rounded-2xl border-2 p-3 ${TONE[c.status]}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900">{ICON[c.status]} {c.title}</p>
            <span className="shrink-0 rounded-full bg-[#14213D] px-2 py-0.5 text-xs font-bold text-white">{c.count}</span>
          </div>
          {c.status !== 'ok' && <p className="text-xs text-gray-700">{c.hint}</p>}
          {c.examples.length > 0 && c.status !== 'ok' && <p className="text-xs text-gray-600">e.g. {c.examples.join(', ')}</p>}
          {c.status !== 'ok' && c.href && <a href={c.href} className="inline-block rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">Open</a>}
        </div>))}
    </div>
  )
}
