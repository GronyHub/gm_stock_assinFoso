'use client'
import { useEffect, useState } from 'react'

type Row = { day: string; receiptCc: number; answer: number; by: string | null; salesTotal: number }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const money = (v: number) => `₵${v.toLocaleString('en-GH', { maximumFractionDigits: 2 })}`

// Days where two different Cash Counted figures exist (the Sales Log's and the closing answer). The manager picks the right one; both then hold it.
export default function CashChoices({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = () => fetch('/api/cash-counted/conflicts', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => setRows(d?.rows ?? [])).catch(() => setRows([]))
  useEffect(() => { void load() }, [])
  async function pick(day: string, value: number) {
    setBusy(true); setErr('')
    const r = await fetch('/api/cash-counted/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day, value }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error ?? 'Could not save.'); return }
    await load(); onChange?.()
  }
  if (rows === null) return <p className="text-sm text-gray-400">Loading…</p>
  if (rows.length === 0) return <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">No day has two different Cash Counted figures.</p>
  return (
    <div className="space-y-2">
      {err && <p className="text-sm text-red-600">{err}</p>}
      {rows.map(r => (
        <div key={r.day} className="rounded-xl border border-amber-300 bg-amber-50 p-3">
          <p className="text-[14px] font-bold text-gray-900">{new Date(`${r.day}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <p className="text-[12px] text-gray-600">Sales that day: {money(r.salesTotal)}. Which Cash Counted is right?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void pick(r.day, r.receiptCc)} className="min-h-[52px] rounded-xl bg-blue-600 px-2 text-[14px] font-bold text-white disabled:opacity-40">{money(r.receiptCc)}<span className="block text-[11px] font-semibold text-blue-100">in the Sales Log</span></button>
            <button type="button" disabled={busy} onClick={() => void pick(r.day, r.answer)} className="min-h-[52px] rounded-xl bg-gray-700 px-2 text-[14px] font-bold text-white disabled:opacity-40">{money(r.answer)}<span className="block text-[11px] font-semibold text-gray-200">closing answer{r.by ? ` by ${cap(r.by)}` : ''}</span></button>
          </div>
        </div>
      ))}
    </div>
  )
}
