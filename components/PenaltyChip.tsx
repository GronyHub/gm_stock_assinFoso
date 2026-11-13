'use client'
import { useEffect, useState } from 'react'
import WithMic from '@/components/WithMic'
import { TIERS } from '@/lib/penaltyRules'

export type PenaltyMe = {
  points: number; learning: boolean; countingFrom: string; warnings: number; fadeIn: number | null
  next: { points: number; days: number; hours: number; label: string } | null
  entries: { id: number; points: number; kind: string; reason: string; day: string; counted: boolean; status: string; source?: string; law_code?: string | null; violation?: string | null; dispute_note?: string | null; ack_at?: string | null; withdraw_reason?: string | null }[]
  sanctions: { id: number; tier: number; status: string; days: number; hours: number; start_date: string | null; end_date: string | null }[]
}
let cached: PenaltyMe | null = null
let at = 0
let pending: Promise<void> | null = null
const subs = new Set<() => void>()
function load(force = false) {
  if (!force && cached && Date.now() - at < 300000) return Promise.resolve()
  if (!pending) pending = fetch('/api/penalties/me', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { cached = d; at = Date.now(); subs.forEach(f => f()) } }).catch(() => {}).finally(() => { pending = null })
  return pending
}
export const reloadPenalty = () => load(true)
export function usePenalty(): PenaltyMe | null {
  const [v, setV] = useState<PenaltyMe | null>(cached)
  useEffect(() => { const f = () => setV(cached); subs.add(f); void load(); return () => { subs.delete(f) } }, [])
  return v
}
export const band = (p: number) => p >= 20 ? { name: 'red', cls: 'bg-red-600 text-white' } : p >= 10 ? { name: 'amber', cls: 'bg-amber-400 text-gray-900' } : { name: 'green', cls: 'bg-green-500 text-white' }

// Small pill with the signed-in person's penalty points; shown at the top of the sidebar and the profile.
export function PenaltyChip({ className = '' }: { className?: string }) {
  const p = usePenalty()
  if (!p) return null
  const b = band(p.points)
  return (
    <a href="/profile" title={p.learning ? `Pilot until ${p.countingFrom}: ${p.warnings} pilot point entr${p.warnings === 1 ? 'y' : 'ies'}, none count yet` : 'Your penalty points'}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[9px] font-extrabold leading-none ${b.cls} ${className}`}>
      ⚖ {p.points}{p.learning && p.warnings > 0 ? ` · ${p.warnings}w` : ''}
    </a>
  )
}

const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

// The full picture, at the top of the profile page.
export function PenaltyCard({ staff }: { staff?: string } = {}) {
  const mine = usePenalty()
  const [other, setOther] = useState<PenaltyMe | null>(null)
  useEffect(() => { if (staff) fetch(`/api/penalties/me?staff=${encodeURIComponent(staff)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setOther(d)).catch(() => {}) }, [staff])
  const p = staff ? other : mine
  const [disputing, setDisputing] = useState<number | null>(null)
  const [dnote, setDnote] = useState('')
  async function act(id: number, action: 'acknowledge' | 'dispute', note?: string) {
    const r = await fetch(`/api/penalties/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error ?? 'Could not save'); return }
    await reloadPenalty()
  }
  if (!p) return null
  const b = band(p.points)
  const target = p.next?.points ?? 50
  const pct = Math.min(100, Math.round((p.points / target) * 100))
  const live = p.sanctions.find(s => s.status === 'approved' && s.end_date && s.end_date >= new Date().toISOString().slice(0, 10))
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold ${b.cls}`}>{p.points}</div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">Penalty points</p>
          <p className="text-[11px] text-gray-500">{p.next ? `At ${p.next.points}: ${p.next.label}${p.next.hours ? ` (${p.next.hours} hours deducted)` : ''}` : 'Dismissal level reached'}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${b.name === 'red' ? 'bg-red-500' : b.name === 'amber' ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${pct}%` }} /></div>
      <p className="mt-1 text-[10px] text-gray-500">Levels: {TIERS.map(t => `${t.points} = ${t.label}${t.hours ? ` (${t.hours} hours deducted)` : ''}`).join(' · ')}</p>
      {p.learning && <p className="mt-2 rounded-lg bg-blue-50 p-2 text-[11px] font-semibold text-blue-800">Learning period until {dlabel(p.countingFrom)}. Violations are warnings for now and do not count. You have {p.warnings} warning{p.warnings === 1 ? '' : 's'}. After that date each violation costs 1 point.</p>}
      {!p.learning && p.points > 0 && p.fadeIn != null && <p className="mt-2 text-[11px] font-semibold text-green-700">Keep a clean record: 5 points come off in {p.fadeIn === 0 ? 'a day or less' : `${p.fadeIn} day${p.fadeIn === 1 ? '' : 's'}`}.</p>}
      {live && <p className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-bold text-red-700">Suspended from {live.start_date} to {live.end_date}, with {live.hours} hours deducted.</p>}
      {p.sanctions.some(s => s.status === 'proposed') && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] font-bold text-amber-800">A sanction has been recommended and is waiting for the owner&apos;s decision.</p>}
      {p.entries.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-bold text-blue-700">Why {staff ? 'these' : 'I have these'} points ({p.entries.length})</summary>
          <div className="mt-1 space-y-1">
            {p.entries.map(e => (
              <div key={e.id} className={`rounded-lg px-2 py-1 text-[11px] ${e.status === 'pending' ? 'bg-amber-50' : e.points < 0 ? 'bg-green-50' : e.counted ? 'bg-red-50' : 'bg-gray-50'}`}>
                <b>{e.points > 0 ? `+${e.points}` : e.points}</b> · {dlabel(e.day)} · {e.reason}
                {e.status === 'pending' ? ' (waiting for the owner to confirm)' : e.points > 0 && !e.counted && e.status === 'active' ? ' (warning, did not count)' : ''}
                {e.status === 'disputed' && <span className="block font-semibold text-amber-800">You disputed this: {e.dispute_note}. It does not count until the owner decides.</span>}
                {e.status === 'withdrawn' && <span className="block font-semibold text-green-800">Withdrawn: {e.withdraw_reason}</span>}
                {!staff && e.source === 'manual' && ['active', 'pending'].includes(e.status) && (
                  <span className="mt-1 flex gap-2">
                    {e.ack_at ? <span className="font-semibold text-gray-500">Acknowledged</span> : <button type="button" onClick={() => void act(e.id, 'acknowledge')} className="rounded-lg bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-gray-800">Acknowledge</button>}
                    <button type="button" onClick={() => { setDisputing(e.id); setDnote('') }} className="rounded-lg bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Dispute</button>
                  </span>
                )}
                {disputing === e.id && (
                  <span className="mt-1 block space-y-1">
                    <WithMic onText={t => setDnote(x => (x ? x + ' ' : '') + t)}><textarea value={dnote} onChange={ev => setDnote(ev.target.value)} rows={3} placeholder="Why do you dispute this? Write or speak what happened." className="w-full rounded-lg border border-gray-300 p-2 text-xs" /></WithMic>
                    <span className="flex gap-2">
                      <button type="button" disabled={dnote.trim().length < 4} onClick={() => { void act(e.id, 'dispute', dnote.trim()); setDisputing(null) }} className="rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40">Send dispute</button>
                      <button type="button" onClick={() => setDisputing(null)} className="rounded-lg bg-gray-200 px-2 py-1 text-[11px] font-bold text-gray-800">Cancel</button>
                    </span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
