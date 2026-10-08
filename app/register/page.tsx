'use client'
import { useState, useEffect } from 'react'

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
  const [filesConsent, setFilesConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ code: string; existing?: boolean } | null>(null)
  const [locations, setLocations] = useState<string[]>([])
  const [showAddLocation, setShowAddLocation] = useState(false)
  const [newLocation, setNewLocation] = useState('')
  const [addingLocation, setAddingLocation] = useState(false)
  const [locationError, setLocationError] = useState('')

  useEffect(() => {
    fetch('/api/public/locations')
      .then(r => r.json())
      .then(data => setLocations(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const toggle = (s: string) => setServices(services.includes(s) ? services.filter(x => x !== s) : [...services, s])

  async function addNewLocation() {
    const name = newLocation.trim()
    if (!name) return

    setAddingLocation(true)
    setLocationError('')
    try {
      const res = await fetch('/api/public/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: name }),
      })

      if (res.ok) {
        setNewLocation('')
        setF({ ...f, location: name })
        setLocations(prev => [...new Set([...prev, name])].sort())
        setShowAddLocation(false)
      } else {
        const data = await res.json().catch(() => ({}))
        setLocationError(data.error || 'Could not add location.')
      }
    } catch (err) {
      setLocationError('Failed to add location.')
    } finally {
      setAddingLocation(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/public/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, services, join_group: joinGroup, files_consent: filesConsent }) })
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
          <p className="text-sm text-orange-200 text-center">Assin Foso · Near GCB Bank · 053 432 8977</p>
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
              <a href="https://wa.me/233534328977" className="inline-block mt-5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-6 py-3">Go Back to WhatsApp</a>
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
              <div className="border border-gray-300 rounded-lg p-3 bg-blue-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className={label}>Town / area</label>
                  <button type="button" onClick={() => setShowAddLocation(!showAddLocation)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                    {showAddLocation ? '− Manage' : '+ Add Location'}
                  </button>
                </div>

                {showAddLocation && (
                  <div className="bg-white border border-blue-200 rounded-lg p-2 space-y-2">
                    <div className="flex gap-2">
                      <input value={newLocation} onChange={e => setNewLocation(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addNewLocation()}
                        placeholder="Type new area (e.g., Kumasi, Cape Coast)"
                        className="flex-1 bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
                      <button type="button" onClick={addNewLocation} disabled={addingLocation || !newLocation.trim()}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition">
                        {addingLocation ? 'Adding…' : 'Add'}
                      </button>
                    </div>
                    {locationError && <p className="text-xs text-red-600">{locationError}</p>}
                    <p className="text-[10px] text-gray-500">Add your town or area if it's not in the list below.</p>
                  </div>
                )}

                <select className={input} value={f.location} onChange={set('location')}>
                  <option value="">Choose your area…</option>
                  {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </div>
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
              <label className="flex items-start gap-2 text-sm text-gray-800 bg-slate-50 border border-gray-200 rounded-lg p-3">
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-orange-600 shrink-0" checked={filesConsent} onChange={e => setFilesConsent(e.target.checked)} />
                <span>Yes, keep my files so I can ask for copies or earlier versions by quoting my customer number. I can ask Grony Multimedia to delete them at any time.</span>
              </label>
              <p className="text-xs text-gray-500 -mt-3">If you leave this unticked, we do not keep your files after the job.</p>
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
