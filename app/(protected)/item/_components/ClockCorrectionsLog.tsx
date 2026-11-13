'use client'
import { useEffect, useState } from 'react'

type Row = { id: number; staff: string; work_date: string; field: string | null; proposed_out: string; status: string; requested_at: string; decided_by: string | null; decided_at: string | null; basis: string | null; note: string | null }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const ymd = (iso: string) => iso.slice(0, 10)
const STATUS: Record<string, string> = { approved: 'bg-green-100 text-green-800', rejected: 'bg-gray-200 text-gray-800', pending: 'bg-amber-100 text-amber-800' }

// The Shop's Times: every clock-in / clock-out time that was sent for approval, when it was sent, and who decided it and at what time. For the owner and Joe.
export default function ClockCorrectionsLog() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open || rows) return
    fetch('/api/clock/corrections?history=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setRows(d?.history ?? [])).catch(() => setRows([]))
  }, [open, rows])
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold text-gray-900">
        <span>🕐 Time approvals: who asked, who approved, and when</span><span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto px-2 pb-2">
          {rows === null && <p className="p-2 text-xs text-gray-500">Loading…</p>}
          {rows && rows.length === 0 && <p className="p-2 text-xs text-gray-500">No time has been sent for approval yet.</p>}
          {rows && rows.length > 0 && (
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead><tr className="border-b border-gray-200 text-[10px] font-extrabold uppercase text-gray-500"><th className="p-1.5">Day</th><th className="p-1.5">Who</th><th className="p-1.5">Time sent</th><th className="p-1.5">Asked</th><th className="p-1.5">Result</th><th className="p-1.5">Decided by</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 align-top">
                    <td className="p-1.5 font-semibold text-gray-900">{r.work_date}</td>
                    <td className="p-1.5">{cap(r.staff)}</td>
                    <td className="p-1.5"><b>{r.field === 'in' ? 'In' : 'Out'}</b> {r.proposed_out}{(r.basis || r.note) ? <span className="block text-[10px] text-gray-500">{[r.basis, r.note].filter(Boolean).join(' · ')}</span> : null}</td>
                    <td className="p-1.5 text-gray-700">{ymd(r.requested_at)} at {hm(r.requested_at)}</td>
                    <td className="p-1.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[r.status] ?? STATUS.pending}`}>{r.status === 'approved' ? 'Approved' : r.status === 'rejected' ? 'Rejected' : 'Waiting'}</span></td>
                    <td className="p-1.5 text-gray-700">{r.decided_by ? <>{cap(r.decided_by)}<span className="block text-[10px] text-gray-500">{r.decided_at ? `${ymd(r.decided_at)} at ${hm(r.decided_at)}` : ''}</span></> : '—'}</td>
                  </tr>))}
              </tbody>
            </table>)}
        </div>)}
    </div>
  )
}
