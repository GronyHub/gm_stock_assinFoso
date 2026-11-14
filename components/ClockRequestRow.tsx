'use client'
import { useState } from 'react'
import { decider, waited } from '@/lib/clockResponsible'

export type ClockRequest = { id: number; staff: string; work_date: string; field?: string | null; proposed_out: string; actual_in?: string | null; estimated?: string | null; requested_at?: string; basis?: string | null }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// ONE row for a clock time waiting for a decision, used everywhere such a time is decided (the approval box on Waiting for team, the approvals log in Shop > Times, and the
// manager's "Before you continue" page), so the wording, the rules and the buttons are the same in all three. `compact` hides the summary line when the caller shows its own.
export default function ClockRequestRow({ p, onDone, compact = false }: { p: ClockRequest; onDone: () => void; compact?: boolean }) {
  const [pick, setPick] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function act(action: 'approve' | 'reject') {
    setBusy(true); setErr('')
    const r = await fetch('/api/clock/corrections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: p.id, action, time: action === 'approve' ? pick || undefined : undefined }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Could not save.'); return }
    onDone()
  }
  const w = p.requested_at ? waited(p.requested_at) : null, who = decider(p.staff)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-900">
      {!compact && <span className="min-w-0 basis-full"><b>{cap(p.staff)}</b> · {p.work_date} · {p.actual_in ? `in ${p.actual_in} · ` : ''}says {p.field === 'in' ? 'in' : 'out'} <b>{p.proposed_out}</b>{p.field !== 'in' && p.estimated ? <span className="text-gray-500"> (app estimate {p.estimated})</span> : null}</span>}
      {p.basis && /CCTV/.test(p.basis) && <span className="basis-full text-[12px] font-bold text-red-800">🎥 {p.basis}</span>}
      {w && <span className={`basis-full text-[12px] font-bold ${w.overdue ? 'text-red-700' : 'text-gray-600'}`}>{who} decides · waiting {w.text}{w.overdue && who === 'Joe' ? ' · Joe has not decided in 2 days: you can step in' : ''}</span>}
      <input type="time" value={pick} onChange={e => setPick(e.target.value)} title="Optional: approve an earlier time instead" className="w-24 rounded-lg border border-gray-300 p-1 text-xs" />
      <button type="button" disabled={busy} onClick={() => void act('approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Approve</button>
      <button type="button" disabled={busy} onClick={() => void act('reject')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800 disabled:opacity-40">Reject</button>
      {err && <span className="basis-full text-xs font-semibold text-red-700">{err}</span>}
    </div>
  )
}
