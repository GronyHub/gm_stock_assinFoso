'use client'
import { useEffect, useState } from 'react'

type Row = { id: number; date: string; qty: number; notes: string | null; by: string | null; source: string | null; at: string | null; expected: number | null; loss_qty: number | null; kind: 'loss' | 'gain' | null }
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })
const timeOf = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '') }
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)

// The details of one count, opened by a tap on its figure in the ledger below (the ledger already shows the count, the counter's initials, the time and the edit history; a long press there edits it).
// This adds what the ledger does not show: the notes and the source, with the way the count compared to what was expected. The owner and Joe can correct it here; only the owner can delete it.
// A correction that creates a loss asks for the reason. Nothing is shown until a count is tapped.
export default function ItemCountRecords({ itemId, canEdit, canDelete }: { itemId: number; canEdit: boolean; canDelete: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})   // the loss reason by day (from the loss records)
  const [focus, setFocus] = useState<number | null>(null)
  const [edit, setEdit] = useState<{ id: number; qty: string; notes: string; reason: string; needReason: boolean } | null>(null)
  const [busy, setBusy] = useState(false), [err, setErr] = useState('')
  const load = () => {
    void fetch(`/api/losses/by-day?item=${itemId}`).then(r => (r.ok ? r.json() : null)).then(d => { const m: Record<string, string> = {}; for (const x of (d?.rows ?? []) as { date: string; reason: string | null }[]) if (x.reason) m[x.date] = x.reason; setReasons(m) }).catch(() => {})
    return fetch(`/api/stock/count-records?item=${itemId}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setRows(d?.rows ?? null)).catch(() => setRows(null))
  }
  useEffect(() => { setRows(null); setFocus(null); setEdit(null); void load() }, [itemId])  // eslint-disable-line react-hooks/exhaustive-deps
  // A tap on a count figure in the ledger below opens this list.
  useEffect(() => {
    const h = (e: Event) => { const d = (e as CustomEvent).detail as { handled: boolean; countId: number }; if (!rows || !rows.some(r => r.id === d.countId)) return; d.handled = true; setFocus(d.countId); setErr(''); setEdit(null); setTimeout(() => document.getElementById(`item-counts-${itemId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80) }
    window.addEventListener('open-item-counts', h); return () => window.removeEventListener('open-item-counts', h)
  }, [itemId, rows])
  if (rows === null || focus === null) return null
  const last = rows.find(r => r.id === focus)
  if (!last) return null
  async function save() {
    if (!edit) return
    setBusy(true); setErr('')
    const res = await fetch(`/api/stock/counts/${edit.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity_counted: Number(edit.qty), notes: edit.notes, ...(edit.needReason ? { loss_reason: edit.reason, manager_response: null } : {}) }) })
    const d = await res.json().catch(() => null)
    setBusy(false)
    if (res.ok) { setEdit(null); await load(); return }
    if (res.status === 409 && d?.requires_loss_reason) { setEdit({ ...edit, needReason: true }); setErr('This count is short. Write the reason, then save again.'); return }
    setErr(d?.error ?? 'Could not save the count.')
  }
  async function del(r: Row) {
    if (!confirm(`Delete the count of ${r.qty} on ${dayLabel(r.date)}? This changes the loss and gain figures from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${r.id}`, { method: 'DELETE' })
    if (res.ok) await load(); else setErr((await res.json().catch(() => null))?.error ?? 'Could not delete the count.')
  }
  const r = last
  return (
    <div id={`item-counts-${itemId}`} className="border-b border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2"><p className="text-sm font-bold text-gray-900">Count of {dayLabel(r.date)}</p><button type="button" onClick={() => { setFocus(null); setEdit(null); setErr('') }} aria-label="Close" className="px-2 text-lg text-gray-400">×</button></div>
      <div className={`px-3 pb-2 ${r.kind === 'loss' ? 'bg-red-50' : r.kind === 'gain' ? 'bg-green-50' : ''}`}>
        {err && <p className="py-1 text-[13px] text-red-600">{err}</p>}
        <p className="text-[13px] font-bold text-gray-900">counted {r.qty}</p>
        <p className="text-[12px] text-gray-700">{r.expected != null ? <>Expected {r.expected} · </> : null}{r.kind === 'loss' ? <b className="text-red-600">short {r.loss_qty}</b> : r.kind === 'gain' ? <b className="text-green-700">gain {r.loss_qty}</b> : <span className="text-gray-500">{r.expected != null ? 'matches' : 'first count'}</span>}</p>
        {reasons[r.date] && <p className="text-[12px] text-red-800"><b>Reason:</b> {reasons[r.date]}</p>}
        {r.notes && r.notes !== reasons[r.date] && <p className="text-[12px] italic text-gray-600">{r.notes}</p>}
        {(r.by || r.at || r.source) && <p className="text-[11px] text-gray-400">{[r.by ? cap(r.by) : '', timeOf(r.at), r.source ?? ''].filter(Boolean).join(' · ')}</p>}
        {edit?.id === r.id ? (
          <div className="mt-1 space-y-1.5 rounded-lg border border-gray-200 bg-white p-2">
            <div className="flex gap-2"><input type="number" inputMode="decimal" min="0" value={edit.qty} onChange={e => setEdit({ ...edit, qty: e.target.value })} className="w-24 rounded border border-gray-300 p-1.5 text-[15px]" /><input value={edit.notes} onChange={e => setEdit({ ...edit, notes: e.target.value })} placeholder="Notes" className="min-w-0 flex-1 rounded border border-gray-300 p-1.5 text-[15px]" /></div>
            {edit.needReason && <input value={edit.reason} onChange={e => setEdit({ ...edit, reason: e.target.value })} placeholder="Reason for the loss" className="w-full rounded border border-red-300 p-1.5 text-[15px]" />}
            <div className="flex gap-2"><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-green-600 px-3 py-1.5 text-[13px] font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => { setEdit(null); setErr('') }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-[13px] font-bold text-gray-700">Cancel</button></div>
          </div>
        ) : (canEdit || canDelete) && (
          <div className="mt-1 flex gap-2">
            {canEdit && <button type="button" onClick={() => { setErr(''); setEdit({ id: r.id, qty: String(r.qty), notes: r.notes ?? '', reason: '', needReason: false }) }} className="rounded bg-gray-100 px-2 py-0.5 text-[12px] font-bold text-gray-800">Edit</button>}
            {canDelete && <button type="button" onClick={() => void del(r).then(() => setFocus(null))} className="rounded bg-red-50 px-2 py-0.5 text-[12px] font-bold text-red-700">Delete</button>}
          </div>)}
      </div>
    </div>
  )
}
