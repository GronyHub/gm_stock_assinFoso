'use client'
import { useState } from 'react'

const SERVICES = [
  'Printing Press Services', 'Large Format Printing', 'Sale of Printing Materials',
  'Software Development', 'Artificial Intelligence Services', 'Internet Cafe Services',
  'Sale of Computer Accessories', 'Photo, Video & Audio', 'Hiring Services',
  'Online Admission Applications',
]
const HEARD = ['WhatsApp', 'Facebook', 'TikTok', 'A friend', 'Walked past the shop', 'Radio / announcement', 'Other']

const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-orange-400'
const label = 'block text-sm font-semibold text-gray-700 mb-1'

export default function RegisterPage() {
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', email: '', location: '', heard_from: '', website: '' })
  const [services, setServices] = useState<string[]>([])
  const [joinGroup, setJoinGroup] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ code: string; existing?: boolean } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const toggle = (s: string) => setServices(services.includes(s) ? services.filter(x => x !== s) : [...services, s])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/public/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, services, join_group: joinGroup }) })
      const d = await r.json()
      if (!r.ok) setError(d.error || 'Please try again.')
      else setDone({ code: d.code, existing: d.existing })
    } catch { setError('No connection. Please try again.') }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-[#14213D] text-white rounded-t-2xl px-5 py-6">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Grony Multimedia" className="h-12 w-auto" />
          </div>
          <h1 className="text-2xl font-extrabold text-center">Grony Multimedia</h1>
          <p className="text-sm text-orange-200 text-center">Assin Foso · Near GCB Bank · 024 853 3826</p>
        </div>
        <div className="h-1.5 bg-[#E85D04]" />
        <div className="bg-white rounded-b-2xl shadow p-5">
          {done ? (
            <div className="text-center py-6 space-y-4">
              <p className="text-lg font-bold text-[#14213D]">✓ Registration Complete!</p>
              <p className="text-gray-700">{done.existing ? 'You are already registered. Your customer number is:' : 'Thank you for registering! Your customer number is:'}</p>
              <div className="bg-orange-50 border-2 border-[#E85D04] rounded-lg p-4">
                <p className="text-5xl font-extrabold text-[#E85D04] font-mono">{done.code}</p>
              </div>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 text-left space-y-2">
                <p className="text-sm font-semibold text-blue-900">📝 Important:</p>
                <p className="text-sm text-blue-800"><b>Save this number.</b> When you send us work on WhatsApp, type this customer ID on the page where you upload your document or in the message.</p>
              </div>
              <p className="text-xs text-gray-500">This helps us track your jobs faster and serve you better.</p>
              <a href="https://wa.me/233248533826" className="inline-block mt-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-6 py-3">Go Back to WhatsApp</a>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3">
                <p className="text-sm font-semibold text-blue-900 mb-1">Why register?</p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li>✓ Get your own customer ID for faster service</li>
                  <li>✓ We track your jobs and orders accurately</li>
                  <li>✓ Easier communication on WhatsApp</li>
                  <li>✓ Special offers just for registered customers</li>
                </ul>
              </div>
              <p className="text-sm text-gray-600">Takes only <b>1 minute.</b> Fill in your details below:</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={label}>First name *</label><input className={input} value={f.first_name} onChange={set('first_name')} required /></div>
                <div><label className={label}>Last name *</label><input className={input} value={f.last_name} onChange={set('last_name')} required /></div>
              </div>
              <div><label className={label}>Phone / WhatsApp number *</label><input className={input} type="tel" inputMode="tel" placeholder="024 123 4567" value={f.phone} onChange={set('phone')} required /></div>
              <div><label className={label}>Email (optional)</label><input className={input} type="email" value={f.email} onChange={set('email')} /></div>
              <div><label className={label}>Town / area</label><input className={input} placeholder="e.g. Assin Foso" value={f.location} onChange={set('location')} /></div>
              <div>
                <label className={label}>Services you are interested in</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {SERVICES.map(s => (
                    <label key={s} className="flex items-center gap-2 text-sm text-gray-800">
                      <input type="checkbox" className="w-4 h-4 accent-orange-600" checked={services.includes(s)} onChange={() => toggle(s)} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div><label className={label}>How did you hear about us?</label>
                <select className={input} value={f.heard_from} onChange={set('heard_from')}>
                  <option value="">Choose…</option>{HEARD.map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <label className="flex items-start gap-2 text-sm text-gray-800">
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-orange-600" checked={joinGroup} onChange={e => setJoinGroup(e.target.checked)} />
                Add me to the Grony Multimedia WhatsApp group for offers and updates
              </label>
              {/* honeypot -- hidden from people, bots fill it */}
              <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden="true" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className="w-full bg-[#E85D04] text-white font-bold rounded-lg py-3 disabled:opacity-60">{busy ? 'Registering…' : 'Register & get my number'}</button>
              <p className="text-[11px] text-gray-400 text-center">Your details are used only by Grony Multimedia to serve you. We never share them.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
