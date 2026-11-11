'use client'
import { cap } from '@/lib/strings'
import { useCallback, useEffect, useState } from 'react'
import { tierLabel } from '@/lib/penaltyRules'

type Person = { staff: string; display_name: string; role: string; points: number; warnings: number }
type Pending = { id: number; staff: string; points: number; reason: string; day: string; created_by: string; status?: string; dispute_note?: string | null }
type Sanction = { id: number; staff: string; tier: number; points_at: number; status: string; days: number; hours: number; start_date: string | null; end_date: string | null }
type Entry = { id: number; staff: string; points: number; kind: string; reason: string; source: string; day: string; counted: boolean; status: string; created_by: string | null }
type Data = { settings: { launch: string; startCounting: string }; people: Person[]; pending: Pending[]; sanctions: Sanction[]; recent: Entry[]; laws: { id: number; text: string; category: string; points: number }[] }
type Rating = { staff: string; n: number; avg: number; low: number }
type Ratings = { month: Rating[]; week: Rating[]; star: string | null; recent: { staff: string; stars: number; comment: string | null; customer: string | null; rated_at: string }[] }
const json = { 'Content-Type': 'application/json' }
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const bandCls = (p: number) => p >= 20 ? 'bg-red-600 text-white' : p >= 10 ? 'bg-amber-400 text-gray-900' : 'bg-green-500 text-white'

// Penalties for the owner and manager: everyone's points, reports to confirm, sanctions to approve, and a form to record a violation.
export default function PenaltiesClient({ isOwner }: { isOwner: boolean }) {
  const [inShop, setInShop] = useState(false)
  useEffect(() => { setInShop(window.parent !== window) }, [])
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ staff: '', reason: '', law_id: '', points: '1' })
  const [start, setStart] = useState('')
  const [rt, setRt] = useState<Ratings | null>(null)
  useEffect(() => { fetch('/api/ratings').then(r => r.ok ? r.json() : null).then(setRt).catch(() => {}) }, [])
  const load = useCallback(async () => {
    try { const r = await fetch('/api/penalties', { cache: 'no-store' }); const j = await r.json(); if (!r.ok) throw new Error(j.error ?? 'Could not load'); setD(j); setStart(j.settings.startCounting); setErr('') } catch (e) { setErr((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function call(url: string, init: RequestInit, ok: string) {
    const r = await fetch(url, init); const j = await r.json().catch(() => ({}))
    if (!r.ok) { flash(j.error ?? 'Failed'); return }
    flash(ok); void load()
  }
  const counting = d ? new Date().toISOString().slice(0, 10) >= d.settings.startCounting : false

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      {/* Inside the Shop's Violations tab the tab already names the page, so the header goes. */}
      {!inShop && <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Penalty points</h1>
        <a href="/laws" className="text-xs font-semibold text-blue-700 underline">Company Laws</a>
      </div>}
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!d && !err && <p className="text-sm text-gray-400">Loading…</p>}
      {d && (<>
        <div className={`mb-3 rounded-xl p-3 text-xs font-semibold ${counting ? 'bg-green-50 text-green-800' : 'bg-blue-50 text-blue-800'}`}>
          {counting ? `Points are counting (since ${dlabel(d.settings.startCounting)}).` : `Learning period: violations are warnings only until ${dlabel(d.settings.startCounting)}.`}
          {isOwner && <span className="ml-2 inline-flex items-center gap-1">Counting starts <input type="date" value={start} onChange={e => setStart(e.target.value)} className="rounded border border-gray-300 p-0.5 text-[11px]" />
            <button type="button" onClick={() => void call('/api/penalties/settings', { method: 'PATCH', headers: json, body: JSON.stringify({ start_counting: start }) }, 'Date saved')} className="rounded bg-[#14213D] px-2 py-0.5 text-[11px] font-bold text-white">Save</button></span>}
        </div>

        {(d.sanctions.some(s => s.status === 'proposed') || d.pending.length > 0) && (
          <p className="mb-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">⚖ {d.sanctions.filter(s => s.status === 'proposed').length} sanction(s) and {d.pending.length} violation(s) are waiting for a decision. They are decided on <b>Waiting for me</b>, in one place. <a href="/my-day" className="ml-1 underline">Open Waiting for me</a></p>
        )}

        <p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">Staff</p>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {d.people.map(p => (
            <div key={p.staff} className="rounded-xl border border-gray-200 bg-white p-2 text-center">
              <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold ${bandCls(p.points)}`}>{p.points}</div>
              <p className="mt-1 text-sm font-bold text-gray-900">{p.display_name || cap(p.staff)}</p>
              <p className="text-[10px] text-gray-500">{p.warnings} warning{p.warnings === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>

        <div className="mb-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-sm font-bold">Record a violation</p>
          <select value={form.staff} onChange={e => setForm(f => ({ ...f, staff: e.target.value }))} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm"><option value="">Which staff member?</option>{d.people.map(p => <option key={p.staff} value={p.staff}>{p.display_name || cap(p.staff)}</option>)}</select>
          <select value={form.law_id} onChange={e => { const l = d.laws.find(x => x.id === Number(e.target.value)); setForm(f => ({ ...f, law_id: e.target.value, points: l ? String(l.points) : f.points, reason: l && !f.reason ? l.text.slice(0, 120) : f.reason })) }} className="w-full rounded-xl border border-gray-300 p-2.5 text-sm"><option value="">Law broken (optional)</option>{d.laws.map(l => <option key={l.id} value={l.id}>{l.category}: {l.text.slice(0, 70)}</option>)}</select>
          <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder="What happened?" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
          <label className="flex items-center gap-2 text-sm font-semibold">Points <input type="number" min={1} max={20} value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" /></label>
          <button type="button" disabled={!form.staff || form.reason.trim().length < 4} onClick={() => void call('/api/penalties', { method: 'POST', headers: json, body: JSON.stringify({ staff: form.staff, reason: form.reason, law_id: form.law_id || null, points: Number(form.points) }) }, 'Recorded').then(() => setForm({ staff: '', reason: '', law_id: '', points: '1' }))} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Record violation</button>
        </div>

        {d.sanctions.filter(s => s.status === 'approved').length > 0 && (
          <div className="mb-3"><p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">Approved sanctions</p>
            {d.sanctions.filter(s => s.status === 'approved').map(s => <p key={s.id} className="rounded-lg bg-gray-50 px-2 py-1 text-xs text-gray-800"><b>{cap(s.staff)}</b> · {tierLabel(s.tier)}{s.start_date ? ` · ${s.start_date} to ${s.end_date}` : ''}{s.hours ? ` · deduct ${s.hours} hours on the payslip` : ''}</p>)}
          </div>
        )}

        <p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">Latest entries</p>
        <div className="space-y-1">
          {d.recent.map(e => (
            <div key={e.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${e.status === 'reversed' || e.status === 'dismissed' ? 'bg-gray-100 text-gray-400 line-through' : e.points < 0 ? 'bg-green-50' : e.counted ? 'bg-red-50' : 'bg-gray-50'}`}>
              <span className="min-w-0 flex-1"><b>{cap(e.staff)}</b> · {e.points > 0 ? `+${e.points}` : e.points} · {dlabel(e.day)} · {e.reason}{e.points > 0 && !e.counted && e.status === 'active' ? ' (warning)' : ''}{e.status === 'pending' ? ' (pending)' : ''}</span>
              {(e.status === 'active') && e.kind === 'violation' && <button type="button" onClick={() => { if (confirm('Take this point back?')) void call(`/api/penalties/${e.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ action: 'reverse' }) }, 'Point reversed') }} className="shrink-0 font-bold text-red-700 underline">Reverse</button>}
            </div>
          ))}
          {d.recent.length === 0 && <p className="text-sm text-gray-400">No entries yet.</p>}
        </div>
      </>)}
      {rt && (
        <div className="mt-6">
          <p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">Customer ratings {rt.star && <span className="ml-1 rounded-full bg-yellow-300 px-2 py-0.5 text-[10px] text-[#14213D]">⭐ Service Star this week: {cap(rt.star)}</span>}</p>
          {rt.month.length === 0 && <p className="text-sm text-gray-400">No ratings yet. They arrive when customers tap the link in a receipt message.</p>}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rt.month.map(r => { const w = rt.week.find(x => x.staff === r.staff); return (
              <div key={r.staff} className="rounded-xl border border-gray-200 bg-white p-2 text-center">
                <p className="text-lg font-extrabold text-amber-600">{r.avg.toFixed(1)} <span className="text-xs">★</span></p>
                <p className="text-sm font-bold text-gray-900">{cap(r.staff)}</p>
                <p className="text-[10px] text-gray-500">{r.n} in 30 days{r.low ? ` · ${r.low} low` : ''}{w ? ` · ${w.avg.toFixed(1)} this week` : ''}</p>
              </div>) })}
          </div>
          {rt.recent.length > 0 && (<div className="mt-2 space-y-1">{rt.recent.map((r, i) => (
            <div key={i} className={`rounded-lg px-2 py-1 text-xs ${r.stars <= 2 ? 'bg-red-50' : 'bg-gray-50'}`}><b>{cap(r.staff)}</b> · <span className="text-amber-500">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>{r.customer ? ` · ${r.customer}` : ''}{r.comment ? ` · "${r.comment}"` : ''}</div>))}</div>)}
        </div>
      )}
      {msg && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{msg}</div>}
    </div>
  )
}
