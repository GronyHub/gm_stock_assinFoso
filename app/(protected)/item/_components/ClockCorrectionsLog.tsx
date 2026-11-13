'use client'
import { useEffect, useState } from 'react'

type Row = { id: number; staff: string; work_date: string; field: string | null; proposed_out: string; status: string; requested_at: string; decided_by: string | null; decided_at: string | null; basis: string | null; note: string | null; against?: string | null }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1] ?? ''}`
const STATUS: Record<string, string> = { approved: 'bg-green-100 text-green-800', rejected: 'bg-gray-200 text-gray-800', pending: 'bg-amber-100 text-amber-800' }

// The Shop's Times: every clock-in / clock-out time that was sent for approval, when it was sent, and who decided it and at what time. For the owner and Joe.
export default function ClockCorrectionsLog({ defaultOpen = false, onClose, me = '' }: { defaultOpen?: boolean; onClose?: () => void; me?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(defaultOpen)
  const [all, setAll] = useState(false)
  const [pick, setPick] = useState<Record<number, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const reload = () => fetch('/api/clock/corrections?history=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRows(d?.history ?? [])).catch(() => {})
  // Decide a request right here: the same rule as the approval box (nobody decides their own time, nor one for a clock-out they did themselves).
  async function decide(id: number, action: 'approve' | 'reject') {
    setBusy(id); setErr('')
    const r = await fetch('/api/clock/corrections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, time: action === 'approve' ? pick[id] : undefined }) })
    const d = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setErr(d.error ?? 'Could not save.'); return }
    await reload()
  }
  useEffect(() => {
    if (!open || rows) return
    fetch('/api/clock/corrections?history=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRows(d?.history ?? [])).catch(() => setRows([]))
  }, [open, rows])
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => (onClose ? onClose() : setOpen(o => !o))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0"><span className="block text-sm font-bold text-gray-900">🕐 Time approvals</span><span className="block text-[10px] text-gray-500">Who asked, who approved, and when</span></span>
        <span className="shrink-0 text-xs font-bold text-gray-400">{onClose ? 'Close ✕' : open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="divide-y divide-gray-100 px-3 pb-2">
          {err && <p className="py-1.5 text-xs font-semibold text-red-700">{err}</p>}
          {rows === null && <p className="py-2 text-xs text-gray-500">Loading…</p>}
          {rows && rows.length === 0 && <p className="py-2 text-xs text-gray-500">No time has been sent for approval yet.</p>}
          {rows && rows.slice(0, all ? 100 : 8).map(r => (
            // Three columns merged into one tidy block per request: who and which time, when it was asked, and the outcome.
            <div key={r.id} className="flex items-start gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-gray-900"><b>{cap(r.staff)}</b> · {short(r.work_date)} · <b>{r.field === 'in' ? 'In' : 'Out'} {r.proposed_out}</b></p>
                <p className="text-[10px] leading-snug text-gray-500">Asked {short(r.requested_at)} {hm(r.requested_at)}{r.basis || r.note ? ` · ${[r.basis, r.note].filter(Boolean).join(' · ')}` : ''}</p>
                {r.status === 'pending' && (r.staff === me.toLowerCase() || (r.against ?? '') === me.toLowerCase()) && <p className="text-[10px] font-semibold leading-snug text-amber-800">Someone else decides this one{r.staff === 'joe' ? ' (Grony)' : ''}.</p>}
                {r.status === 'pending' && r.staff !== me.toLowerCase() && (r.against ?? '') !== me.toLowerCase() && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <input type="time" value={pick[r.id] ?? ''} onChange={e => setPick(x => ({ ...x, [r.id]: e.target.value }))} title="Optional: approve an earlier time instead" className="w-[5.5rem] rounded-md border border-gray-300 p-1 text-[11px]" />
                    <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, 'approve')} className="rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40">Approve</button>
                    <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, 'reject')} className="rounded-md bg-gray-200 px-2.5 py-1 text-[11px] font-bold text-gray-800 disabled:opacity-40">Reject</button>
                  </div>)}
                {r.decided_by && <p className="text-[10px] leading-snug text-gray-700">{r.status === 'rejected' ? 'Rejected' : 'Approved'} by <b>{cap(r.decided_by)}</b>{r.decided_at ? ` · ${short(r.decided_at)} ${hm(r.decided_at)}` : ''}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[r.status] ?? STATUS.pending}`}>{r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Waiting'}</span>
            </div>))}
          {rows && rows.length > 8 && <button type="button" onClick={() => setAll(a => !a)} className="w-full py-1.5 text-center text-[11px] font-bold text-blue-700">{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
        </div>)}
    </div>
  )
}
