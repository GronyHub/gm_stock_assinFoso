'use client'
import { useEffect, useState } from 'react'

type P = { id: number; staff: string; work_date: string; proposed_out: string; actual_in: string | null; estimated: string | null }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
// For Grony and Joe only: clock-out times staff entered after forgetting, waiting for approval. Not a tile on the Daily Checklist.
export default function ClockApprovals() {
  const [list, setList] = useState<P[]>([])
  const [pendingReviews, setPendingReviews] = useState(0)
  const load = () => {
    fetch('/api/clock/corrections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setList(d?.pending ?? [])).catch(() => {})
    fetch('/api/cctv-review?summary=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPendingReviews(d?.pending ?? 0)).catch(() => {})
  }
  useEffect(() => { load() }, [])
  async function act(id: number, action: 'approve' | 'reject') {
    await fetch('/api/clock/corrections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    load()
  }
  if (!list.length && !pendingReviews) return null
  return (
    <div className="mx-auto max-w-3xl space-y-2 px-3 pt-3">
      {pendingReviews > 0 && <a href="/cctv-review" className="block rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{pendingReviews} CCTV review{pendingReviews === 1 ? '' : 's'} waiting: staff worked while Joe was not clocked in. Open the review →</a>}
      {list.length > 0 && (
        <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-extrabold text-amber-900">Clock-out times to approve</p>
          {list.map(p => (
            <div key={p.id} className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-900">
              <span className="min-w-0 flex-1"><b>{cap(p.staff)}</b> · {p.work_date} · in {p.actual_in ?? '?'} · says out <b>{p.proposed_out}</b>{p.estimated ? <span className="text-gray-600"> (app estimate {p.estimated})</span> : null}</span>
              <button type="button" onClick={() => void act(p.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button>
              <button type="button" onClick={() => void act(p.id, 'reject')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reject</button>
            </div>))}
        </div>)}
    </div>
  )
}
