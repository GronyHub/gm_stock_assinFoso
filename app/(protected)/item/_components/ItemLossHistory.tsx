'use client'
import { useEffect, useState } from 'react'

type Row = { date: string; name: string; expected: number; counted: number; loss_qty: number; loss_amt: number; reason: string | null; by: string | null; at: string | null; source: string | null }
const c = (v: number) => `₵${Math.round(v).toLocaleString('en-GH')}`
const dayLabel = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' })
const timeOf = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '') }
const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1)

// The item's loss history for the owner and Joe: how much was lost in total, how many times, the latest, and every loss with its reason, who counted, when and the source.
// It is the "losses only" view of the ledger below it (which lists every day).
export default function ItemLossHistory({ itemId }: { itemId: number }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setRows(null)
    fetch(`/api/losses/by-day?item=${itemId}`).then(r => (r.ok ? r.json() : null)).then(d => setRows(d?.rows ?? null)).catch(() => setRows(null))
  }, [itemId])
  if (rows === null) return null   // not for staff (the API says no), or not loaded
  if (rows.length === 0) return <div className="border-b border-gray-200 px-3 py-2 text-[13px] text-gray-500">No losses on record for this item.</div>
  const total = rows.reduce((s, r) => s + r.loss_amt, 0), qty = rows.reduce((s, r) => s + r.loss_qty, 0)
  return (
    <div className="border-b border-gray-200 bg-white">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="text-sm font-bold text-gray-900">Losses <span className="font-semibold text-red-600">{c(total)}</span> <span className="font-normal text-gray-500">· {rows.length} time{rows.length === 1 ? '' : 's'} · {qty} short · latest {dayLabel(rows[0].date)}</span></span>
        <span className="text-gray-400">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="divide-y divide-red-100 border-t border-red-100">
          {rows.map(r => (
            <div key={r.date} className="px-3 py-1.5">
              <div className="flex items-baseline justify-between gap-2"><p className="text-[13px] font-bold text-gray-900">{dayLabel(r.date)}</p><p className="text-[13px] font-extrabold text-red-600">{c(r.loss_amt)}</p></div>
              <p className="text-[12px] text-gray-700">Expected {r.expected} · counted {r.counted} · <b className="text-red-600">short {r.loss_qty}</b></p>
              {r.reason && <p className="text-[12px] italic text-gray-600">{r.reason}</p>}
              {(r.by || r.at || r.source) && <p className="text-[11px] text-gray-400">{[r.by ? cap(r.by) : '', timeOf(r.at), r.source ?? ''].filter(Boolean).join(' · ')}</p>}
            </div>))}
        </div>)}
    </div>
  )
}
