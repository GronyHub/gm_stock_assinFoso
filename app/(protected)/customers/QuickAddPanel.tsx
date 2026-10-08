'use client'
import { useCallback, useEffect, useState } from 'react'

type Result = {
  id: number; code: string; display_name: string; phone: string | null; existing: boolean
  link: string; message: string; jobCard: string; waUrl: string | null
}
type Row = Result & { status: 'invited' | 'opened' | 'completed'; files_consent: boolean; invited_at: string | null }

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5 block'
const BADGE: Record<string, string> = {
  invited: 'bg-gray-100 text-gray-600', opened: 'bg-amber-100 text-amber-700', completed: 'bg-green-100 text-green-700',
}

export default function QuickAddPanel({ onChanged }: { onChanged: () => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/customers/quick-add', { cache: 'no-store' })
      if (r.ok) setRows(await r.json())
    } catch { /* list is a convenience */ }
  }, [])
  useEffect(() => { load() }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = await fetch('/api/customers/quick-add', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, name }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Could not create the customer.')
      setResult(d); setPhone(''); setName(''); load(); onChanged()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create the customer.') }
    finally { setBusy(false) }
  }

  async function copy(label: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(''), 1800) }
    catch { setError('Copy failed. Select the text and copy it by hand.') }
  }

  function ResultCard({ r }: { r: Result }) {
    return (
      <div className="border border-orange-200 bg-orange-50 rounded-xl p-3 space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-3xl font-extrabold text-orange-600 font-mono">{r.code}</p>
          <p className="text-xs text-gray-600">{r.existing ? 'Already in the app, reusing this number' : 'New customer created'}{r.phone ? ` · ${r.phone}` : ' · no phone yet'}</p>
        </div>
        <textarea readOnly value={r.message} rows={5} className={inputCls + ' text-xs'} />
        <div className="flex flex-wrap gap-2">
          {r.waUrl && <a href={r.waUrl} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white font-semibold">Open WhatsApp chat</a>}
          <button type="button" onClick={() => copy('msg', r.message)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white">{copied === 'msg' ? 'Copied' : 'Copy message'}</button>
          <button type="button" onClick={() => copy('job', r.jobCard)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white">{copied === 'job' ? 'Copied' : 'Copy job card'}</button>
          <button type="button" onClick={() => copy('link', r.link)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white">{copied === 'link' ? 'Copied' : 'Copy link only'}</button>
        </div>
        {!r.waUrl && <p className="text-xs text-gray-600">No phone number, so copy the message and paste it into the chat. The customer will type their number on the page.</p>}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="space-y-3 bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-xs text-gray-500">For someone who sent work on WhatsApp and is not in the app yet. Enter their number (or leave it empty for an @username contact). We give them the next GM number and a message to send.</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>WhatsApp number</label>
            <input className={inputCls} inputMode="tel" placeholder="024 123 4567" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div><label className={labelCls}>Name (optional)</label>
            <input className={inputCls} placeholder="If you know it" value={name} onChange={e => setName(e.target.value)} /></div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-60">{busy ? 'Creating…' : 'Create and get message'}</button>
      </form>

      {result && <ResultCard r={result} />}

      <div>
        <p className="text-xs font-bold text-gray-500 mb-1">Recent WhatsApp invites</p>
        {rows.length === 0 ? <p className="text-sm text-gray-400">None yet.</p> : (
          <ul className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-xl">
            {rows.map(r => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="font-mono font-bold text-gray-900 w-16">{r.code}</span>
                <span className="flex-1 min-w-0 truncate text-gray-700">{r.display_name}{r.phone ? ` · ${r.phone}` : ''}</span>
                {r.files_consent && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">files kept</span>}
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${BADGE[r.status]}`}>{r.status}</span>
                <button type="button" onClick={() => setResult(r)} className="text-xs text-blue-600 hover:underline">Message</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
