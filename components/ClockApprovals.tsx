'use client'
import { cap } from '@/lib/strings'
import { useEffect, useState } from 'react'

type P = { id: number; staff: string; work_date: string; field?: string; proposed_out: string; actual_in: string | null; estimated: string | null }
// For Grony and Joe only: clock-out times staff entered after forgetting, waiting for approval. Not a tile on the Daily Checklist.
export default function ClockApprovals() {
  const [list, setList] = useState<P[]>([])
  const [pendingReviews, setPendingReviews] = useState(0)
  const load = () => {
    fetch('/api/clock/corrections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setList(d?.pending ?? [])).catch(() => {})
    fetch('/api/cctv-review?summary=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPendingReviews((d?.pending || d?.all || 0))).catch(() => {})
  }
  // Kept fresh: a time sent while this page is open shows up without reloading.
  useEffect(() => {
    load()
    const again = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', again); window.addEventListener('focus', again)
    const t = setInterval(again, 60000)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [pick, setPick] = useState<Record<number, string>>({})
  async function act(id: number, action: 'approve' | 'reject') {
    await fetch('/api/clock/corrections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, time: action === 'approve' ? pick[id] : undefined }) })
    load()
  }
  const [me, setMe] = useState('')
  const [sent, setSent] = useState('')
  useEffect(() => { fetch('/api/auth/session').then(r => r.json()).then(d => setMe(String(d?.user?.username ?? d?.user?.name ?? '').toLowerCase())).catch(() => {}) }, [])
  async function nudge() { const r = await fetch('/api/clock/nudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const d = await r.json().catch(() => ({})); setSent(d?.sent ? 'Joe has been prompted.' : 'Nothing is waiting for Joe.') }
  if (!list.length && !pendingReviews && me !== 'grony') return null
  return (
    <div className="mx-auto max-w-3xl space-y-2 px-3 pt-3">
      {me === 'grony' && <div className="flex items-center gap-2"><button type="button" onClick={() => void nudge()} className="rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">Prompt Joe to check</button>{sent && <span className="text-xs text-gray-700">{sent}</span>}</div>}
      {pendingReviews > 0 && <a href="/cctv-review" onClick={e => { const ev = { path: '/cctv-review', handled: false }; window.dispatchEvent(new CustomEvent('hub-open', { detail: ev })); if (ev.handled) e.preventDefault() }} className="block rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{pendingReviews} CCTV review{pendingReviews === 1 ? '' : 's'} waiting: staff worked while Joe was not clocked in. Open the review →</a>}
      {list.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-extrabold text-amber-900">Clock-in and clock-out times to approve</p>
          {list.map(p => (
            <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-900">
              <span className="min-w-0 flex-1"><b>{cap(p.staff)}</b> · {p.work_date} · in {p.actual_in ?? '?'} · says {p.field === 'in' ? 'in' : 'out'} <b>{p.proposed_out}</b>{p.field !== 'in' && p.estimated ? <span className="text-gray-600"> (app estimate {p.estimated})</span> : null}</span>
              <input type="time" value={pick[p.id] ?? ''} onChange={e => setPick(x => ({ ...x, [p.id]: e.target.value }))} title="Optional: approve an earlier time instead" className="w-24 rounded-lg border p-1 text-xs" />
              <button type="button" onClick={() => void act(p.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button>
              <button type="button" onClick={() => void act(p.id, 'reject')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reject</button>
            </div>))}
        </div>)}
    </div>
  )
}
