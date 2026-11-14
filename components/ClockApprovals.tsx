'use client'
import { cap } from '@/lib/strings'
import { useEffect, useRef, useState } from 'react'
import type { TileDensity } from '@/components/TaskTile'
import ClockRequestRow from '@/components/ClockRequestRow'

type P = { id: number; staff: string; work_date: string; field?: string; proposed_out: string; actual_in: string | null; estimated: string | null; requested_at?: string; basis?: string | null }
// For Grony and Joe only: clock-out times staff entered after forgetting, waiting for approval. Not a tile on the Daily Checklist.
export default function ClockApprovals(_props: { density?: TileDensity }) {
  const [list, setList] = useState<P[]>([])
  const load = () => {
    fetch('/api/clock/corrections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setList(d?.pending ?? [])).catch(() => {})
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
  const [me, setMe] = useState('')
  const [sent, setSent] = useState('')
  useEffect(() => { fetch('/api/auth/session').then(r => r.json()).then(d => setMe(String(d?.user?.username ?? d?.user?.name ?? '').toLowerCase())).catch(() => {}) }, [])
  async function nudge() { const r = await fetch('/api/clock/nudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const d = await r.json().catch(() => ({})); setSent(d?.sent ? 'Joe has been prompted.' : 'Nothing is waiting for Joe.') }
  if (!list.length && me !== 'grony') return null
  return (
    <>
      {/* CCTV reviews show as the "CCTV reviews to do" duty tile, not here. */}
      {me === 'grony' && (
        <div className="col-span-full flex items-center gap-2"><button type="button" onClick={() => void nudge()} className="rounded-md bg-[#14213D] px-2.5 py-1 text-[11px] font-bold text-white">🔔 Prompt Joe to check</button>{sent && <span className="text-[11px] text-gray-600">{sent}</span>}</div>)}
      {list.length > 0 && (
        <div ref={boxRef} className="col-span-full rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-extrabold text-amber-900">Clock-in and clock-out times to approve</p>
          {list.map(p => <div key={p.id} className="mt-2"><ClockRequestRow p={p} onDone={load} /></div>)}
        </div>)}
    </>
  )
}
