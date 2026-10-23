'use client'
import { useRef, useState } from 'react'
import CustomerBox from './CustomerBox'

export type TapCustomerInfo = {
  id: number; item_name: string; customer_id_code?: string | null; customer_name?: string | null; customer_phone?: string | null
  buyer_id?: number | null; buyer_name?: string | null; buyer_phone?: string | null
}
const json = { 'Content-Type': 'application/json' }

// Sales Log (one sale of one item): see who it was sold to, send them the WhatsApp message, or
// attach / change the customer (a saved customer by GM ID, phone or name, or a new one).
export default function TapCustomerSheet({ tap, onClose, onChanged, onRegister }: {
  tap: TapCustomerInfo; onClose: () => void; onChanged: () => void
  onRegister: (phone: string, done: (code: string) => void) => void
}) {
  const name = tap.customer_name ?? tap.buyer_name
  const phone = tap.customer_phone ?? tap.buyer_phone
  const [val, setVal] = useState('')
  const typedName = useRef('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function attach(body: Record<string, unknown>) {
    const r = await fetch(`/api/sales/live-taps/${tap.id}/customer`, { method: 'POST', headers: json, body: JSON.stringify(body) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error ?? 'Could not save')
    return d as { buyerId: number; customer_id_code: string; customer_name: string }
  }
  async function whatsapp() {
    const w = window.open('', '_blank')
    setBusy(true); setMsg('')
    try {
      const d = await attach(tap.customer_id_code ? { code: tap.customer_id_code } : { phone })
      const r = await fetch(`/api/sales/buyers/whatsapp?ids=${d.buyerId}`)
      const u = await r.json()
      if (!r.ok || !u.url) throw new Error(u.error ?? 'No phone number for this customer yet.')
      if (w) w.location.href = u.url; else window.location.href = u.url
    } catch (e) { w?.close(); setMsg((e as Error).message) }
    setBusy(false)
  }
  async function save() {
    setBusy(true); setMsg('')
    try {
      const isPhone = /^0\d{9}$/.test(val)
      const d = await attach(isPhone ? { phone: val, name: typedName.current } : { code: `GM${val}` })
      setMsg(`Saved: ${d.customer_name} (${d.customer_id_code})`)
      onChanged()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto w-full max-w-md space-y-3 rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold text-gray-900">{tap.item_name}</p>
          <p className="text-sm text-gray-600">
            {name || tap.customer_id_code || phone
              ? `Sold to ${name ?? 'customer'}${tap.customer_id_code ? ` (${tap.customer_id_code})` : ''}${phone ? ` · ${phone}` : ''}`
              : 'No customer recorded for this sale.'}
          </p>
        </div>
        {(tap.customer_id_code || phone) && (
          <button type="button" disabled={busy} onClick={() => void whatsapp()} className="w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white disabled:opacity-40">Send on WhatsApp</button>
        )}
        <div className="space-y-1.5 border-t border-gray-100 pt-3">
          <p className="text-xs font-bold uppercase text-gray-500">{tap.customer_id_code || phone ? 'Change customer' : 'Add the customer'} (GM ID, phone or name)</p>
          <div className="rounded-lg border border-gray-300 px-2 py-2">
            <CustomerBox value={val} onChange={setVal} onName={n => { typedName.current = n }} onRegister={onRegister}
              placeholder="GM / phone / name" className="w-full text-sm font-semibold text-gray-900 outline-none" />
          </div>
          <button type="button" disabled={busy || !val} onClick={() => void save()} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">Save customer on this sale</button>
        </div>
        {msg && <p className="text-sm font-semibold text-gray-700">{msg}</p>}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}
