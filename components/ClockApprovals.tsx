'use client'
import { cap } from '@/lib/strings'
import { useEffect, useRef, useState } from 'react'
import TaskTile, { type TileDensity } from '@/components/TaskTile'
import { decider, waited } from '@/lib/clockResponsible'

type P = { id: number; staff: string; work_date: string; field?: string; proposed_out: string; actual_in: string | null; estimated: string | null; requested_at?: string; basis?: string | null }
// For Grony and Joe only: clock-out times staff entered after forgetting, waiting for approval. Not a tile on the Daily Checklist.
export default function ClockApprovals({ density = 'compact' }: { density?: TileDensity }) {
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
  // The "Clock times to approve" tile opens this page with ?approve=1: scroll to the box once it has loaded, and ring it for a few seconds.
  const boxRef = useRef<HTMLDivElement | null>(null)
  const scrolled = useRef(false)
  useEffect(() => {
    if (scrolled.current || !list.length || !boxRef.current || new URLSearchParams(window.location.search).get('approve') !== '1') return
    scrolled.current = true
    const el = boxRef.current
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-4', 'ring-blue-500'); setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500'), 4000)
  }, [list])
  useEffect(() => {
    const f = (e: Event) => {
      if ((e as CustomEvent).detail !== 'approve') return
      let tries = 0   // the box may still be loading when the tile is tapped
      const t = setInterval(() => { const el = boxRef.current; if (el) { clearInterval(t); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-4', 'ring-blue-500'); setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500'), 4000) } else if (++tries > 12) clearInterval(t) }, 300)
    }
    window.addEventListener('wft-focus-ready', f); return () => window.removeEventListener('wft-focus-ready', f)
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
    <>
      {pendingReviews > 0 && (
        <div className="flex flex-col gap-1">
          <TaskTile density={density} icon="🎥" time="48h" title={`CCTV reviews: ${pendingReviews} waiting`} detail="Staff worked while Joe was not clocked in." category="Standing duty" type="Review" who="Joe" tone="border-red-300 bg-red-50"
            onClick={() => { const ev = { path: '/cctv-review', handled: false }; window.dispatchEvent(new CustomEvent('hub-open', { detail: ev })); if (!ev.handled) window.location.href = '/cctv-review' }} />
          {me === 'grony' && <button type="button" onClick={() => void nudge()} className="rounded-md bg-[#14213D] px-2 py-1 text-[10px] font-bold text-white">🔔 Prompt Joe</button>}
          {sent && <span className="text-[10px] text-gray-600">{sent}</span>}
        </div>)}
      {pendingReviews === 0 && me === 'grony' && (
        <div className="col-span-full flex items-center gap-2"><button type="button" onClick={() => void nudge()} className="rounded-md bg-[#14213D] px-2.5 py-1 text-[11px] font-bold text-white">🔔 Prompt Joe to check</button>{sent && <span className="text-[11px] text-gray-600">{sent}</span>}</div>)}
      {list.length > 0 && (
        <div ref={boxRef} className="col-span-full rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-extrabold text-amber-900">Clock-in and clock-out times to approve</p>
          {list.map(p => (
            <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-900">
              <span className="min-w-0 flex-1"><b>{cap(p.staff)}</b> · {p.work_date} · in {p.actual_in ?? '?'} · says {p.field === 'in' ? 'in' : 'out'} <b>{p.proposed_out}</b>{p.field !== 'in' && p.estimated ? <span className="text-gray-600"> (app estimate {p.estimated})</span> : null}</span>
              {p.basis && /CCTV/.test(p.basis) && <span className="basis-full text-[11px] font-bold text-red-800">🎥 {p.basis}</span>}
              {p.requested_at && (() => { const w = waited(p.requested_at), who = decider(p.staff); return <span className={`basis-full text-[11px] font-bold ${w.overdue ? 'text-red-700' : 'text-gray-600'}`}>{who} decides · waiting {w.text}{w.overdue && who === 'Joe' ? ' · Joe has not decided in 2 days: you can step in' : ''}</span> })()}
              <input type="time" value={pick[p.id] ?? ''} onChange={e => setPick(x => ({ ...x, [p.id]: e.target.value }))} title="Optional: approve an earlier time instead" className="w-24 rounded-lg border p-1 text-xs" />
              <button type="button" onClick={() => void act(p.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button>
              <button type="button" onClick={() => void act(p.id, 'reject')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reject</button>
            </div>))}
        </div>)}
    </>
  )
}
