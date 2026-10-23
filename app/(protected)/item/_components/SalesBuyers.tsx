'use client'
import { useState } from 'react'

export type Buyer = {
  id: number; receipt_id: number; item_id: number | null; item_name: string; qty: string; price: string
  customer_id_code: string | null; customer_name: string | null; customer_phone: string | null
  saved_phone: string | null; saved_name: string | null; source: string; created_by: string | null
}

const json = { 'Content-Type': 'application/json' }

// Under a day's receipt in the Sales Log: who bought what. For each buyer: send the purchase
// message on WhatsApp, or, if they are not a saved customer yet, type a name (and phone) to
// save them as a customer.
export default function SalesBuyers({ buyers, onChanged }: { buyers: Buyer[]; onChanged: () => void }) {
  const groups = new Map<string, Buyer[]>()
  for (const b of buyers) {
    const key = b.customer_id_code ?? b.customer_phone ?? `row${b.id}`
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  return (
    <div className="space-y-1.5 bg-green-50/60 px-2 py-1.5 text-[11px]">
      <p className="text-[10px] font-bold uppercase text-green-800">Customers on this day&apos;s sales</p>
      {[...groups.values()].map(list => <BuyerGroup key={list[0].id} list={list} onChanged={onChanged} />)}
    </div>
  )
}

function BuyerGroup({ list, onChanged }: { list: Buyer[]; onChanged: () => void }) {
  const first = list[0]
  const phone = first.customer_phone ?? first.saved_phone
  const name = first.saved_name ?? first.customer_name
  const [typedName, setTypedName] = useState('')
  const [typedPhone, setTypedPhone] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const items = list.map(b => `${parseFloat(b.qty)} × ${b.item_name}`).join(', ')
  const needsCustomer = !first.customer_id_code

  async function whatsapp() {
    // Open the tab straight away (a click is needed to allow it), then point it at WhatsApp.
    const w = window.open('', '_blank')
    try {
      const r = await fetch(`/api/sales/buyers/whatsapp?ids=${list.map(b => b.id).join(',')}`)
      const d = await r.json()
      if (!r.ok || !d.url) throw new Error(d.error ?? 'No phone number yet')
      if (w) w.location.href = d.url; else window.location.href = d.url
    } catch (e) { w?.close(); setMsg((e as Error).message) }
  }
  async function saveCustomer() {
    setBusy(true); setMsg('')
    try {
      const r = await fetch(`/api/sales/buyers/${first.id}`, { method: 'POST', headers: json, body: JSON.stringify({ name: typedName, phone: phone ?? typedPhone }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save')
      setMsg(`Saved as ${d.customer_id_code}`); onChanged()
    } catch (e) { setMsg((e as Error).message) }
    setBusy(false)
  }

  return (
    <div className="rounded-lg border border-green-200 bg-white p-1.5">
      <p className="font-bold text-gray-900">
        {name ?? 'Customer'}{first.customer_id_code ? ` · ${first.customer_id_code}` : ''}{phone ? ` · ${phone}` : ''}
      </p>
      <p className="text-gray-600">{items}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {phone && <button type="button" onClick={() => void whatsapp()} className="rounded bg-green-600 px-2 py-1 text-[10px] font-bold text-white">Send on WhatsApp</button>}
        {needsCustomer && (
          <>
            {!phone && <input value={typedPhone} onChange={e => setTypedPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="Phone 0XXXXXXXXX" inputMode="numeric" className="w-28 rounded border border-gray-300 px-1.5 py-1 text-[11px]" />}
            <input value={typedName} onChange={e => setTypedName(e.target.value)} placeholder="Customer name" className="w-32 rounded border border-gray-300 px-1.5 py-1 text-[11px]" />
            <button type="button" disabled={busy || !typedName.trim() || !(phone || /^0\d{9}$/.test(typedPhone))} onClick={() => void saveCustomer()} className="rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white disabled:opacity-40">Save as customer</button>
          </>
        )}
        {!phone && !needsCustomer && <span className="text-[10px] text-gray-400">No phone number saved for this customer</span>}
        {msg && <span className="text-[10px] font-semibold text-gray-700">{msg}</span>}
      </div>
    </div>
  )
}
