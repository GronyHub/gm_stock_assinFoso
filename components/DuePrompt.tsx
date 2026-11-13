'use client'
import { useCallback, useEffect, useState } from 'react'
import { useFeatures } from '@/lib/useFeatures'

type Due = { id: number; title: string; time: string | null; kind: string }
const day = () => new Date().toISOString().slice(0, 10)
const KEY = (id: number) => `duePrompt:${day()}:${id}`
const SNOOZE_MIN = 10

// "It's time for ...": when one of my checklist tasks falls due, a prompt asks me to tick it Done, or Not required today (with the reason), or to be reminded in 10 minutes.
// A task that needs more than a tick (a question, a photo, people, a question group) opens in Waiting for team instead.
export default function DuePrompt() {
  const features = useFeatures()   // Settings > Switches
  const [list, setList] = useState<Due[]>([])
  const [why, setWhy] = useState('')
  const [notReq, setNotReq] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = useCallback(() => {
    if (document.visibilityState !== 'visible' || window.location.pathname.startsWith('/login')) return
    fetch('/api/due-now', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      const now = Date.now()
      const open = (d?.due ?? []).filter((x: Due) => { try { const v = localStorage.getItem(KEY(x.id)); return !v || (v.startsWith('snooze:') && Number(v.slice(7)) < now) } catch { return true } })
      setList(open)
    }).catch(() => {})
  }, [])
  useEffect(() => {
    const t0 = setTimeout(load, 8000)
    const t = setInterval(load, 2 * 60 * 1000)
    document.addEventListener('visibilitychange', load)
    return () => { clearTimeout(t0); clearInterval(t); document.removeEventListener('visibilitychange', load) }
  }, [load])
  const cur = list[0]
  if (!cur) return null
  if (!features.due_prompt) return null
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/start-of-day')) return null   // never cover the manager's "Before you continue" page
  const mark = (v: string) => { try { localStorage.setItem(KEY(cur.id), v) } catch { /* private window */ } }
  const next = () => { setList(l => l.slice(1)); setWhy(''); setNotReq(false); setErr('') }
  async function record(value: 'Done' | 'Not done', note?: string) {
    setBusy(true); setErr('')
    const r = await fetch('/api/daily-checks/tap', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tile_id: cur.id, value, note }) })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(d.error ?? 'Could not save.'); return }
    mark('done'); next()
  }
  const open = () => { mark(`snooze:${Date.now() + SNOOZE_MIN * 60000}`); const p = `/todo?tile=${cur.id}`; if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path: p }, window.location.origin); else window.location.href = p; next() }
  const simple = cur.kind === 'tap'
  return (
    <div className="fixed inset-x-2 top-2 z-[88] mx-auto max-w-md space-y-2 rounded-2xl border-2 border-amber-400 bg-white p-3 shadow-xl print:hidden" role="alertdialog">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-amber-700">It&apos;s time{cur.time ? ` · ${cur.time}` : ''}{list.length > 1 ? ` · ${list.length - 1} more after this` : ''}</p>
      <p className="text-sm font-bold text-gray-900">It&apos;s time for: {cur.title}</p>
      {!notReq ? (
        <div className="flex flex-wrap gap-1.5">
          {simple
            ? <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-green-600 py-2 text-sm font-bold text-white"><input type="checkbox" disabled={busy} onChange={() => void record('Done')} className="h-5 w-5" />Done</label>
            : <button type="button" onClick={open} className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-bold text-white">Open it</button>}
          <button type="button" onClick={() => setNotReq(true)} className="rounded-xl bg-gray-200 px-3 py-2 text-sm font-bold text-gray-800">Not required</button>
          <button type="button" onClick={() => { mark(`snooze:${Date.now() + SNOOZE_MIN * 60000}`); next() }} className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-gray-600 ring-1 ring-gray-300">In {SNOOZE_MIN} min</button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input value={why} onChange={e => setWhy(e.target.value)} placeholder="Why is it not required today?" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <p className="text-[11px] text-gray-500">The reason is recorded with your name. The manager can overrule it, and then it counts as not done.</p>
          <div className="flex gap-1.5">
            <button type="button" disabled={busy || why.trim().length < 4} onClick={() => void record('Not done', `Not required: ${why.trim()}`)} className="flex-1 rounded-xl bg-gray-700 py-2 text-sm font-bold text-white disabled:opacity-40">Not required today</button>
            <button type="button" onClick={() => setNotReq(false)} className="rounded-xl bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700">Back</button>
          </div>
        </div>
      )}
      {err && <p className="text-xs font-semibold text-red-700">{err}</p>}
    </div>
  )
}
