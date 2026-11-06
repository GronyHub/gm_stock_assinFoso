'use client'
import { useState } from 'react'

// Sales Log day row: the cash counted (CC) for the day, typed straight in, and the work-not-written (WNW) it gives:
// CC minus the day's walk-in sales receipt total (the figure Sales Rec, P&L and the high-WNW flag use; it can differ
// from the sum of the Log's rows when a sale was moved to another day after it was recorded). CC is saved on the day's walk-in sales receipt (sales_receipts.cash_counted),
// the same field Sales Rec (now the Log's Summary) edits, so reports, P&L and the "no cash counted" / "high WNW"
// flags keep working unchanged. WNW colours match Sales Rec: orange = more cash than sales written down,
// red = cash short, green = they agree.
export default function DayCashCell({ receiptId, cashCounted, salesTotal, onSaved }: {
  receiptId: number | null
  cashCounted: number | null
  salesTotal: number
  onSaved: (cash: number, receiptTotal: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  async function save() {
    const v = parseFloat(val)
    if (!receiptId || isNaN(v) || v < 0 || v === cashCounted) { setEditing(false); return }
    setBusy(true); setErr(false)
    try {
      const r = await fetch(`/api/sales/${receiptId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cash_counted: v }),
      })
      if (!r.ok) throw new Error(String(r.status))
      const row = await r.json().catch(() => null) as { invoice_amount?: string | number | null } | null
      const t = row?.invoice_amount === null || row?.invoice_amount === undefined ? null : Number(row.invoice_amount)
      onSaved(v, t !== null && !isNaN(t) ? t : null)
      setEditing(false)
    } catch { setErr(true) }
    setBusy(false)
  }

  const wnw = cashCounted === null ? null : Math.round((cashCounted - salesTotal) * 100) / 100
  const wnwCls = wnw === null ? 'text-gray-400' : wnw > 0 ? 'text-orange-600' : wnw < 0 ? 'text-red-600' : 'text-green-600'
  const money = (v: number) => v.toLocaleString('en-GH', { maximumFractionDigits: 2 })

  if (!receiptId) {
    return <span className="text-[8px] text-gray-400" title="No walk-in sales on this day yet">CC —</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[8px] font-semibold leading-none whitespace-nowrap">
      {editing ? (
        <span className="inline-flex items-center gap-0.5">
          <span className="text-gray-600">CC ₵</span>
          <input autoFocus type="number" inputMode="decimal" min={0} step="0.01" value={val} disabled={busy}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={() => void save()}
            className="h-[12px] w-14 rounded border border-blue-400 bg-white px-0.5 text-[8px] outline-none" />
        </span>
      ) : (
        <button type="button" onClick={() => { setVal(cashCounted === null ? '' : String(cashCounted)); setEditing(true) }}
          title="Cash counted for this day: tap to enter or change it"
          className={`rounded px-1 leading-none ${cashCounted === null ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-gray-700 hover:bg-green-100'}`}>
          {cashCounted === null ? '+ CC' : `CC ₵${money(cashCounted)}`}
        </button>
      )}
      {err && <span className="text-red-600" title="Could not save the cash counted. Try again.">⚠</span>}
      <span className={wnwCls} title="Work not written: cash counted minus the day's walk-in sales">
        WNW {wnw === null ? '—' : `₵${money(wnw)}`}
      </span>
    </span>
  )
}
