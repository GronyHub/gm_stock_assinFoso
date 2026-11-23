'use client'
import { cap } from '@/lib/strings'
import { useEffect, useRef, useState } from 'react'
import type { TileDensity } from '@/components/TaskTile'
import ClockRequestRow from '@/components/ClockRequestRow'

type P = { id: number; staff: string; work_date: string; field?: string; proposed_out: string; actual_in: string | null; estimated: string | null; requested_at?: string; basis?: string | null }
// For Grony and Joe only: clock-out times staff entered after forgetting, waiting for approval. Not a tile on the Daily Checklist.
export default function ClockApprovals(_props: { density?: TileDensity }) {
  const [list, setList] = useState<P[]>([])
  type X = { id: number; staff: string; work_date: string; kind: string; minutes: number; sched: string | null; actual: string | null }
  const [extra, setExtra] = useState<X[]>([])   // time before the rostered start / after the rostered end, waiting to be approved for pay
  const load = () => {
    fetch('/api/clock/corrections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setList(d?.pending ?? [])).catch(() => {})
    fetch('/api/clock/extra-time', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setExtra(d?.data?.rows ?? d?.rows ?? [])).catch(() => {})
  }
  const decide = async (id: number, approve: boolean) => { await fetch('/api/clock/extra-time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, approve }) }); load() }
  const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)
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
  const [me, setMe] = useState('')
  const [sent, setSent] = useState('')
  useEffect(() => { fetch('/api/auth/session').then(r => r.json()).then(d => setMe(String(d?.user?.username ?? d?.user?.name ?? '').toLowerCase())).catch(() => {}) }, [])
  async function nudge() { const r = await fetch('/api/clock/nudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const d = await r.json().catch(() => ({})); setSent(d?.sent ? 'Joe has been prompted.' : 'Nothing is waiting for Joe.') }
  if (!list.length && !extra.length && me !== 'grony') return null
  return (
    <>
      {/* CCTV reviews show as the "CCTV reviews to do" duty tile, not here. */}
      {false && me === 'grony' && (
        <div className="col-span-full flex items-center gap-2"><button type="button" onClick={() => void nudge()} className="rounded-md bg-[#14213D] px-2.5 py-1 text-[12px] font-bold text-white">🔔 Prompt Joe to check</button>{sent && <span className="text-[12px] text-gray-600">{sent}</span>}</div>)}
      {extra.length > 0 && (
        <div className="col-span-full rounded-xl border-2 border-indigo-300 bg-indigo-50 p-3">
          <p className="text-sm font-extrabold text-indigo-900">Extra time to approve for pay</p>
          <p className="text-[12px] text-indigo-800">Time before the rostered start or after the rostered finish is paid only if you approve it (you asked them to come early or stay on).</p>
          {extra.map(x => (
            <div key={x.id} className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-[13px]">
              <span className="min-w-0 flex-1"><b>{cap(x.staff)}</b> {x.kind === 'early' ? 'clocked in' : 'stayed'} <b>{dur(x.minutes)}</b> {x.kind === 'early' ? `before the ${x.sched} start (in at ${x.actual})` : `after the ${x.sched} finish (out at ${x.actual})`} on {x.work_date}.</span>
              <button type="button" onClick={() => void decide(x.id, true)} className="rounded-md bg-green-600 px-2.5 py-1 text-[12px] font-bold text-white">Approve</button>
              <button type="button" onClick={() => void decide(x.id, false)} className="rounded-md bg-gray-200 px-2.5 py-1 text-[12px] font-bold text-gray-800">Do not pay</button>
            </div>))}
        </div>)}
      {list.length > 0 && (
        <div ref={boxRef} className="col-span-full rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-extrabold text-amber-900">Clock-in and clock-out times to approve</p>
          {list.map(p => <div key={p.id} className="mt-2"><ClockRequestRow p={p} onDone={load} /></div>)}
        </div>)}
    </>
  )
}
