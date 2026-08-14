'use client'
import { useState } from 'react'
import LocationField from '@/components/LocationField'

type Customer = {
  id: number
  display_name: string
  company_name: string | null
  phone: string | null
  email: string | null
  location: string | null
  notes: string | null
  last_visited: string | null
  service_goods: string | null
  whatsapp_group_added: boolean
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'

// Moved out of customers/page.tsx -- "New Customer" is now its own
// left-pane item/page (see item/page.tsx's 'newCustomer' LossView), not a
// toggle-open panel embedded in the Customers list page itself, so this
// needed a home outside that file.
export default function NewCustomerForm({ onCreated, onCancel, initialDisplayName }: { onCreated: (c: Customer) => void; onCancel: () => void; initialDisplayName?: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [lastVisited, setLastVisited] = useState('')
  const [serviceGoods, setServiceGoods] = useState('')
  const [whatsappAdded, setWhatsappAdded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!displayName.trim()) { setError('Customer name is required.'); return }

    setSaving(true)
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName.trim(),
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        last_visited: lastVisited || null,
        service_goods: serviceGoods.trim() || null,
        whatsapp_group_added: whatsappAdded,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onCreated(await res.json())
    } else {
      const d = await res.json().catch(() => null)
      setError(d?.error ?? 'Could not save customer.')
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-bold text-gray-900">New Customer</p>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
      </div>

      <div>
        <label className={labelCls}>Customer Name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)}
          placeholder="e.g. Kwame Mensah" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Company (optional)</label>
        <input value={companyName} onChange={e => setCompanyName(e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Phone</label>
          <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
        </div>
      </div>
      <LocationField value={location} onChange={setLocation} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Last Visited</label>
          <input type="date" value={lastVisited} onChange={e => setLastVisited(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Service/Goods</label>
          <input value={serviceGoods} onChange={e => setServiceGoods(e.target.value)}
            placeholder="e.g. Printing, Photocopies" className={inputCls} />
        </div>
      </div>
      <label className="flex items-center gap-1.5 cursor-pointer select-none">
        <input type="checkbox" checked={whatsappAdded} onChange={() => setWhatsappAdded(v => !v)}
          className="w-3.5 h-3.5 accent-blue-600" />
        <span className="text-xs font-semibold text-gray-700">Added to Group Whatsapp Page</span>
      </label>
      <div>
        <label className={labelCls}>Notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

      <div className="flex gap-2">
        <button onClick={submit} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
          {saving ? 'Saving…' : 'Save Customer'}
        </button>
        <button onClick={onCancel} className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">Cancel</button>
      </div>
    </div>
  )
}
