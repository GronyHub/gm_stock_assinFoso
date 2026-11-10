'use client'
import { useCallback, useEffect, useState } from 'react'
import { cap } from '@/lib/strings'
import { tierLabel } from '@/lib/penaltyRules'

type Pending = { id: number; staff: string; points: number; reason: string; day: string; created_by: string; status?: string; dispute_note?: string | null }
type Sanction = { id: number; staff: string; tier: number; points_at: number; status: string }
const json = { 'Content-Type': 'application/json' }
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// The one place sanctions and reported or disputed violations are decided (Waiting for me). Joe decides for the other staff, Grony for Joe; nobody decides their own.
export default function PenaltyDecisions({ onChange }: { onChange?: () => void }) {
  const [d, setD] = useState<{ me: string; pending: Pending[]; sanctions: Sanction[] } | null>(null)
  const [msg, setMsg] = useState('')
  const load = useCallback(async () => {
    try { const r = await fetch('/api/penalties', { cache: 'no-store' }); if (r.ok) setD(await r.json()) } catch { /* not for this person */ }
  }, [])
  useEffect(() => { void load() }, [load])
  async function call(url: string, init: RequestInit, ok: string) {
    const r = await fetch(url, init); const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? ok : (j.error ?? 'Failed')); setTimeout(() => setMsg(''), 3000)
    if (r.ok) { void load(); onChange?.() }
  }
  if (!d) return null
  const can = (staff: string) => d.me !== staff.toLowerCase() && (d.me === 'grony' || d.me === 'joe')
  const sanc = d.sanctions.filter(s => s.status === 'proposed' && can(s.staff))
  const pend = d.pending.filter(p => can(p.staff))
  if (!sanc.length && !pend.length && !msg) return null
  return (
    <div className="space-y-2">
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {sanc.map(s => (
        <div key={`s${s.id}`} className="rounded-2xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-bold text-gray-900">⚖ Sanction: {cap(s.staff)} · {s.points_at} points</p>
          <p className="text-xs text-gray-700">Recommended: {tierLabel(s.tier)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => { if (confirm(s.tier >= 50 ? 'Approve the dismissal? Carry it out in Users.' : `Approve the suspension for ${cap(s.staff)}? It starts tomorrow, blocks clock-in and ticking, and their points drop to ${s.tier / 2}.`)) void call(`/api/penalties/sanctions/${s.id}`, { method: 'POST', headers: json, body: JSON.stringify({ action: 'approve' }) }, 'Approved') }} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-bold text-white">Approve</button>
            <button type="button" onClick={() => void call(`/api/penalties/sanctions/${s.id}`, { method: 'POST', headers: json, body: JSON.stringify({ action: 'reject' }) }, 'Not applied')} className="flex-1 rounded-lg bg-gray-200 py-2 text-sm font-bold text-gray-800">Do not apply</button>
          </div>
        </div>))}
      {pend.map(p => (
        <div key={`p${p.id}`} className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-bold text-gray-900">⚖ {p.status === 'disputed' ? 'Disputed violation' : 'Violation to confirm'}: {cap(p.staff)} · {p.points} point</p>
          <p className="text-xs text-gray-700">{p.reason}</p><p className="text-[10px] text-gray-500">{dlabel(p.day)} · reported by {cap(p.created_by ?? '')}</p>
          {p.status === 'disputed' && <p className="mt-1 rounded-lg bg-white p-2 text-xs text-red-800"><b>Disputed by {cap(p.staff)}:</b> {p.dispute_note}</p>}
          {p.status === 'disputed' ? (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void call(`/api/penalties/${p.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action: 'uphold' }) }, 'Violation upheld')} className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white">Uphold: it counts</button>
              <button type="button" onClick={() => { const reason = prompt('Why is it withdrawn? (kept on record)'); if (reason) void call(`/api/penalties/${p.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action: 'withdraw', reason }) }, 'Violation withdrawn') }} className="flex-1 rounded-lg bg-gray-200 py-1.5 text-xs font-bold text-gray-800">Withdraw</button>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => void call(`/api/penalties/${p.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action: 'confirm' }) }, 'Point confirmed')} className="flex-1 rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white">Confirm the point</button>
              <button type="button" onClick={() => void call(`/api/penalties/${p.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action: 'dismiss' }) }, 'Dismissed')} className="flex-1 rounded-lg bg-gray-200 py-1.5 text-xs font-bold text-gray-800">Dismiss</button>
            </div>
          )}
        </div>))}
    </div>
  )
}
