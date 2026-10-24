'use client'
import { useState } from 'react'

export type ExtraPhone = { id: number; phone: string; label: string | null }
const json = { 'Content-Type': 'application/json' }
const inputCls = 'bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'

// A customer's phone numbers: the main one (used for messages) plus any number of extras.
export default function CustomerPhones({ customerId, main, extras, onChange }: {
  customerId: number; main: string | null; extras: ExtraPhone[]; onChange: (main: string | null, extras: ExtraPhone[]) => void
}) {
  const [phone, setPhone] = useState('')
  const [label, setLabel] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function call(url: string, init?: RequestInit) {
    setBusy(true); setMsg('')
    try {
      const r = await fetch(url, init)
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save')
      onChange(d.main ?? null, d.extras ?? [])
      return true
    } catch (e) { setMsg((e as Error).message); return false } finally { setBusy(false) }
  }
  async function add() {
    if (await call(`/api/customers/${customerId}/phones`, { method: 'POST', headers: json, body: JSON.stringify({ phone, label }) })) { setPhone(''); setLabel('') }
  }

  return (
    <div className="space-y-1.5 border-t border-gray-100 pt-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Phone numbers</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-gray-900">{main ?? '—'}</span>
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">MAIN · messages go here</span>
      </div>
      {extras.map(p => (
        <div key={p.id} className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-900">{p.phone}</span>
          {p.label && <span className="text-gray-500">{p.label}</span>}
          <button type="button" disabled={busy} onClick={() => void call(`/api/customers/${customerId}/phones`, { method: 'PATCH', headers: json, body: JSON.stringify({ phoneId: p.id, makeMain: true }) })}
            className="font-semibold text-blue-600 disabled:opacity-40">Make main</button>
          <button type="button" disabled={busy} onClick={() => { if (confirm(`Remove ${p.phone}?`)) void call(`/api/customers/${customerId}/phones?phoneId=${p.id}`, { method: 'DELETE' }) }}
            className="font-semibold text-red-600 disabled:opacity-40">Remove</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        <input value={phone} onChange={e => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))} placeholder="Another number (0XXXXXXXXX)" inputMode="tel" className={inputCls + ' w-48'} />
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Office)" className={inputCls + ' w-36'} />
        <button type="button" disabled={busy || phone.replace(/\D/g, '').length < 9} onClick={() => void add()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">+ Add number</button>
      </div>
      {msg && <p className="text-xs font-semibold text-red-600">{msg}</p>}
    </div>
  )
}
