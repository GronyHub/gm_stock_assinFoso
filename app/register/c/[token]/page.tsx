'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

const FILES_CONSENT_TEXT =
  'Yes, keep my files so I can ask for copies or earlier versions by quoting my customer number. I can ask Grony Multimedia to delete them at any time.'

const input = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-orange-400'
const label = 'block text-sm font-semibold text-gray-700 mb-1'

type Step = 'phone' | 'form' | 'done' | 'already'

export default function CompleteDetailsPage() {
  const params = useParams()
  const token = String(params?.token ?? '')
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [f, setF] = useState({ display_name: '', email: '', location: '' })
  const [consent, setConsent] = useState(false)
  const [locations, setLocations] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/public/locations').then(r => r.json()).then(d => setLocations(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function call(action: 'verify' | 'complete', extra: Record<string, unknown> = {}) {
    const r = await fetch('/api/public/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, token, phone, ...extra }),
    })
    const data = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
    return data
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await call('verify')
      setCode(d.code)
      if (d.alreadyRegistered) { setStep('already'); return }
      setF({ display_name: d.prefill?.display_name ?? '', email: d.prefill?.email ?? '', location: d.prefill?.location ?? '' })
      setStep('form')
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const d = await call('complete', { ...f, files_consent: consent })
      setCode(d.code); setStep('done')
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong.') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-[#14213D] text-white rounded-t-2xl px-5 py-6">
          <div className="flex justify-center mb-4"><img src="/logo.png" alt="Grony Multimedia" className="h-12 w-auto bg-white rounded-lg px-3 py-1" /></div>
          <h1 className="text-2xl font-extrabold text-center">Grony Multimedia</h1>
          <p className="text-sm text-orange-200 text-center">Assin Foso · Near GCB Bank · 053 432 8977</p>
        </div>
        <div className="h-1.5 bg-[#E85D04]" />
        <div className="bg-white rounded-b-2xl shadow p-5">
          {step === 'phone' && (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-gray-800">Please confirm your <b>phone number</b> to open your details.</p>
              <div><label className={label}>Your phone / WhatsApp number</label>
                <input className={input} type="tel" inputMode="tel" placeholder="024 123 4567" value={phone} onChange={e => setPhone(e.target.value)} required autoFocus /></div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className="w-full bg-[#E85D04] text-white font-bold rounded-lg py-3 disabled:opacity-60">{busy ? 'Checking…' : 'Continue'}</button>
              <p className="text-[11px] text-gray-400 text-center">We only use this to check that the link is yours.</p>
            </form>
          )}

          {step === 'form' && (
            <form onSubmit={save} className="space-y-4">
              <div className="bg-orange-50 border-2 border-[#E85D04] rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600">Your customer number</p>
                <p className="text-4xl font-extrabold text-[#E85D04] font-mono">{code}</p>
                <p className="text-xs text-gray-600 mt-1">Quote it when you send us work so we find it faster.</p>
              </div>
              <div><label className={label}>Your name, or your organisation&apos;s name *</label>
                <input className={input} value={f.display_name} onChange={e => setF({ ...f, display_name: e.target.value })} required /></div>
              <div><label className={label}>Email (optional)</label>
                <input className={input} type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
              <div><label className={label}>Town / area (optional)</label>
                <select className={input} value={f.location} onChange={e => setF({ ...f, location: e.target.value })}>
                  <option value="">Choose your area…</option>
                  {f.location && !locations.includes(f.location) && <option value={f.location}>{f.location}</option>}
                  {locations.map(l => <option key={l} value={l}>{l}</option>)}
                </select></div>
              <label className="flex items-start gap-2 text-sm text-gray-800 bg-slate-50 border border-gray-200 rounded-lg p-3">
                <input type="checkbox" className="w-4 h-4 mt-0.5 accent-orange-600 shrink-0" checked={consent} onChange={e => setConsent(e.target.checked)} />
                <span>{FILES_CONSENT_TEXT}</span>
              </label>
              <p className="text-xs text-gray-500">If you leave this unticked, we do not keep your files after the job.</p>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button disabled={busy} className="w-full bg-[#E85D04] text-white font-bold rounded-lg py-3 disabled:opacity-60">{busy ? 'Saving…' : 'Save my details'}</button>
            </form>
          )}

          {step === 'done' && (
            <div className="text-center py-4 space-y-4">
              <p className="text-lg font-bold text-[#14213D]">Thank you!</p>
              <p className="text-gray-700">Your customer number is:</p>
              <div className="bg-orange-50 border-2 border-[#E85D04] rounded-lg p-4"><p className="text-5xl font-extrabold text-[#E85D04] font-mono">{code}</p></div>
              <p className="text-sm text-gray-600">Quote it when you send us work, and we find it faster.</p>
              <a href="https://wa.me/233534328977" className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-6 py-3">Back to WhatsApp</a>
            </div>
          )}

          {step === 'already' && (
            <div className="text-center py-4 space-y-4">
              <p className="text-gray-700">This number is already registered. Your customer number is:</p>
              <div className="bg-orange-50 border-2 border-[#E85D04] rounded-lg p-4"><p className="text-5xl font-extrabold text-[#E85D04] font-mono">{code}</p></div>
              <p className="text-sm text-gray-600">Quote it when you send us work. If you need help, message us on WhatsApp.</p>
              <a href="https://wa.me/233534328977" className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg px-6 py-3">Back to WhatsApp</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
