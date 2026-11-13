'use client'
import { useEffect, useState } from 'react'
import { decider, waited } from '@/lib/clockResponsible'
import ClockRequestRow from '@/components/ClockRequestRow'

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
  const reload = () => fetch('/api/clock/corrections?history=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRows(d?.history ?? [])).catch(() => {})
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
          {rows === null && <p className="py-2 text-xs text-gray-500">Loading…</p>}
          {rows && rows.length === 0 && <p className="py-2 text-xs text-gray-500">No time has been sent for approval yet.</p>}
          {rows && rows.slice(0, all ? 100 : 8).map(r => (
            // Three columns merged into one tidy block per request: who and which time, when it was asked, and the outcome.
            <div key={r.id} className="flex items-start gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-snug text-gray-900"><b>{cap(r.staff)}</b> · {short(r.work_date)} · <b>{r.field === 'in' ? 'In' : 'Out'} {r.proposed_out}</b></p>
                <p className="text-[10px] leading-snug text-gray-500">Asked {short(r.requested_at)} {hm(r.requested_at)}{r.basis || r.note ? ` · ${[r.basis, r.note].filter(Boolean).join(' · ')}` : ''}</p>
                {r.status === 'pending' && (r.staff === me.toLowerCase() || (r.against ?? '') === me.toLowerCase()) && (() => { const w = waited(r.requested_at), who = decider(r.staff); return <p className={`text-[10px] font-bold leading-snug ${w.overdue ? 'text-red-700' : 'text-gray-600'}`}>{who} decides · waiting {w.text}{w.overdue ? ` · ${who} has not decided in 2 days${who === 'Joe' ? ': you can step in' : ''}` : ''}</p> })()}
                {r.status === 'pending' && r.staff === me.toLowerCase() && <p className="text-[10px] font-semibold leading-snug text-amber-800">Your own time: {r.staff === 'joe' ? 'Grony' : 'Joe or Grony'} decides it.</p>}
                {r.status === 'pending' && r.staff !== me.toLowerCase() && (r.against ?? '') === me.toLowerCase() && <p className="text-[10px] font-semibold leading-snug text-amber-800">You clocked {cap(r.staff)} out, so you cannot approve this one.</p>}
                {r.status === 'pending' && r.staff !== me.toLowerCase() && (r.against ?? '') !== me.toLowerCase() && <div className="mt-1"><ClockRequestRow p={r} compact onDone={() => void reload()} /></div>}
                {r.decided_by && <p className="text-[10px] leading-snug text-gray-700">{r.status === 'rejected' ? 'Rejected' : 'Approved'} by <b>{cap(r.decided_by)}</b>{r.decided_at ? ` · ${short(r.decided_at)} ${hm(r.decided_at)}` : ''}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[r.status] ?? STATUS.pending}`}>{r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Waiting'}</span>
            </div>))}
          {rows && rows.length > 8 && <button type="button" onClick={() => setAll(a => !a)} className="w-full py-1.5 text-center text-[11px] font-bold text-blue-700">{all ? 'Show fewer' : `Show all ${rows.length}`}</button>}
        </div>)}
    </div>
  )
}
