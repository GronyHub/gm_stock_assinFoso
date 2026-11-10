'use client'
import SnoozeChips from '@/components/SnoozeChips'
import { useEffect, useState } from 'react'
import LawLink from '@/components/LawLink'
import WithMic from '@/components/WithMic'
import { isSnoozed } from '@/lib/snooze'

// Joe (and the owner) must review the CCTV for days staff worked without Joe clocked in. The reminder can be put off for an hour, but not once a day is 2+ days old.
// Also: staff questions raised by those reviews appear here for the person asked to answer.
const SNOOZE = 'cctvGateSnoozeUntil'
type Q = { id: number; from_user: string; about: string; work_date: string }
export default function CctvGate() {
  const [pending, setPending] = useState(0)
  const [oldest, setOldest] = useState<string | null>(null)
  const [qs, setQs] = useState<Q[]>([])
  const [ans, setAns] = useState('')
  const [msg, setMsg] = useState('')
  const [qLater, setQLater] = useState(false)
  useEffect(() => { setQLater(isSnoozed('cctvQSnooze')); const t = setInterval(() => setQLater(isSnoozed('cctvQSnooze')), 60000); return () => clearInterval(t) }, [])
  const check = () => {
    if (window.location.pathname.startsWith('/login')) return
    fetch('/api/cctv-review?summary=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) { setPending(d.pending ?? 0); setOldest(d.oldest ?? null) } }).catch(() => {})
    fetch('/api/staff-queries', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (d) setQs(d.queries ?? []) }).catch(() => {})
  }
  useEffect(() => { check(); const t = setInterval(check, 5 * 60 * 1000); return () => clearInterval(t) }, [])
  const [snoozed, setSnoozed] = useState(false)
  useEffect(() => { const f = () => { try { setSnoozed(Date.now() < Number(localStorage.getItem(SNOOZE) ?? 0)) } catch { /* ignore */ } }; f(); const t = setInterval(f, 60000); return () => clearInterval(t) }, [pending])
  const [embed, setEmbed] = useState<string | null>(null)
  useEffect(() => { const f = (e: Event) => setEmbed((e as CustomEvent).detail ?? null); window.addEventListener('embed-changed', f); return () => window.removeEventListener('embed-changed', f) }, [])
  const onPage = (typeof window !== 'undefined' && window.location.pathname.startsWith('/cctv-review')) || !!embed?.startsWith('/cctv-review')
  if (qs.length && !qLater) {
    const q = qs[0]
    return (
      <div className="fixed inset-0 z-[97] flex items-end justify-center bg-black/70 sm:items-center print:hidden">
        <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
          <p className="text-base font-extrabold text-[#14213D]">A question about {q.work_date}</p>
          <p className="text-sm text-gray-800"><b>{q.from_user}</b> asks: {q.about}</p>
          <WithMic onText={t => setAns(x => (x ? x + ' ' : '') + t)}><textarea value={ans} onChange={e => setAns(e.target.value)} rows={3} placeholder="Your answer" className="w-full rounded-xl border-2 border-gray-300 p-2 text-sm" /></WithMic>
          {msg && <p className="text-sm font-bold text-red-700">{msg}</p>}
          <LawLink name="Review the CCTV when staff work without the manager" />
          <button type="button" disabled={ans.trim().length < 3} onClick={async () => { const r = await fetch('/api/staff-queries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: q.id, answer: ans }) }); if (r.ok) { setAns(''); setMsg(''); check() } else setMsg('Could not send. Try again.') }} className="w-full rounded-xl bg-[#14213D] py-2.5 text-sm font-bold text-white disabled:opacity-40">Send my answer</button>
          <SnoozeChips storageKey="cctvQSnooze" title="Answer later: remind me in" onDone={() => setQLater(true)} />
        </div>
      </div>)
  }
  if (!pending || onPage || snoozed) return null
  return (
    <div className="fixed inset-0 z-[97] flex items-end justify-center bg-black/70 sm:items-center print:hidden">
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <p className="text-base font-extrabold text-red-700">CCTV review needed</p>
        <p className="text-sm text-gray-800">{pending} day{pending === 1 ? ' has' : 's have'} staff at work while you were not clocked in. Review the CCTV and confirm that every sale and every law was as expected.</p>
        <LawLink name="Review the CCTV when staff work without the manager" />
        <a href="/cctv-review" className="block w-full rounded-xl bg-red-600 py-2.5 text-center text-sm font-bold text-white">Review the CCTV now</a>
        <SnoozeChips storageKey={SNOOZE} onDone={() => setSnoozed(true)} />
      </div>
    </div>
  )
}
