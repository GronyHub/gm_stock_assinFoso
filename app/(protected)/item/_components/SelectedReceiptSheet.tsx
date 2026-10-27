'use client'
import { useRef, useState } from 'react'
import CustomerBox from './CustomerBox'
import type { SaleTap } from './TapCustomerSheet'

const json = { 'Content-Type': 'application/json' }
const money = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Sales Log: receipt for sales that are already recorded. The chosen rows go on ONE receipt for ONE customer
// (the sales themselves, stock and totals are untouched; this only writes the receipt document).
export default function SelectedReceiptSheet({ taps, onClose, onDone, onRegister }: {
  taps: SaleTap[]
  onClose: () => void
  onDone: (r: { invoiceNumber: string; whatsappUrl: string | null; printUrl: string }) => void
  onRegister: (phone: string, done: (code: string) => void) => void
}) {
  const codes = [...new Set(taps.map(t => t.customer_id_code).filter((c): c is string => !!c))]
  const missing = taps.filter(t => !t.customer_id_code)
  const known = taps.find(t => t.customer_name ?? t.buyer_name)
  const knownName = known ? (known.customer_name ?? known.buyer_name) : null
  const buyerPhone = taps.map(t => t.buyer_phone ?? t.customer_phone).find(p => p && /^0\d{9}$/.test(p)) ?? ''
  const [val, setVal] = useState(codes.length ? '' : buyerPhone)
  const typedName = useRef(knownName ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const total = taps.reduce((s, t) => s + Number(t.price) * t.quantity, 0)
  const days = new Set(taps.map(t => t.tapped_at.slice(0, 10)))
  const tooMany = codes.length > 1
  const needCustomer = !tooMany && missing.length > 0

  async function create() {
    setBusy(true); setMsg('')
    try {
      if (needCustomer) {
        if (!val) throw new Error('Choose the customer first (GM number, phone or name).')
        const isPhone = /^0\d{9}$/.test(val)
        const body = codes.length ? { code: codes[0] } : isPhone ? { phone: val, name: typedName.current } : { code: `GM${val}` }
        for (const t of missing) {
          const r = await fetch(`/api/sales/live-taps/${t.id}/customer`, { method: 'POST', headers: json, body: JSON.stringify(body) })
          const d = await r.json().catch(() => ({}))
          if (!r.ok) throw new Error(d.error ?? 'Could not save the customer')
        }
      }
      const r = await fetch('/api/sales/live-receipt', { method: 'POST', headers: json, body: JSON.stringify({ tapIds: taps.map(t => t.id) }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Could not issue the receipt')
      onDone({ invoiceNumber: d.invoiceNumber, whatsappUrl: d.whatsappUrl ?? null, printUrl: d.printUrl })
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[88vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold text-gray-900">Create receipt from {taps.length} recorded sale{taps.length === 1 ? '' : 's'}</p>
        <div className="rounded-xl bg-green-50 p-2.5">
          {taps.map(t => (
            <p key={t.id} className="flex justify-between gap-2 text-xs text-gray-800">
              <span className="min-w-0 truncate"><span className="text-gray-400">{dayLabel(t.tapped_at)}</span> · {t.quantity} × {t.item_name}</span>
              <span className="shrink-0 font-semibold">{money(Number(t.price) * t.quantity)}</span>
            </p>
          ))}
          <p className="mt-1 border-t border-green-200 pt-1 text-right text-sm font-bold text-green-800">Total {money(total)}</p>
        </div>
        {days.size > 1 && <p className="text-xs text-amber-700">These are from different days. The receipt takes the date of the earliest one.</p>}
        {tooMany && <p className="rounded-lg bg-red-50 p-2 text-sm font-semibold text-red-700">These sales belong to {codes.length} different customers ({codes.join(', ')}). A receipt is for one customer, so select one customer&apos;s sales at a time.</p>}
        {!tooMany && !needCustomer && <p className="text-sm text-gray-700">Customer: <b>{knownName ?? codes[0]}</b> ({codes[0]})</p>}
        {needCustomer && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">
              {codes.length ? `${missing.length} of these sales have no customer yet. They will be saved under ${codes[0]}.` : 'Who are these sales for? The customer is saved on every sale you chose.'}
            </p>
            {!codes.length && (
              <div className="rounded-lg border border-gray-300 px-2 py-2">
                <CustomerBox value={val} onChange={setVal} onName={n => { typedName.current = n }} onRegister={onRegister}
                  placeholder="GM / phone / name" className="w-full text-sm font-semibold text-gray-900 outline-none" />
              </div>
            )}
          </div>
        )}
        {msg && <p className="text-sm font-semibold text-red-600">{msg}</p>}
        <button type="button" disabled={busy || tooMany || (needCustomer && !codes.length && !val)} onClick={() => void create()}
          className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">
          {busy ? 'Creating…' : `Create receipt (${money(total)})`}
        </button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}
