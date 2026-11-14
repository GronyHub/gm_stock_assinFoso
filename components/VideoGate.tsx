'use client'
import { useEffect, useRef, useState } from 'react'
import { useFeatures } from '@/lib/useFeatures'

type V = { key: string; label: string; src: string; dueDate: string; overdue: boolean }
const day = () => new Date().toISOString().slice(0, 10)
const LATER = () => `videoGateLater:${day()}`

// Before work: a tile video the person has not yet watched to the end is shown after they log in. It closes only when the video
// plays to the end (recorded, so the law "Watch each tile video to the end within 7 days" is kept), or with "Later today",
// which is allowed once a day. One video at a time, the most overdue first.
export default function VideoGate() {
  const features = useFeatures()   // Settings > Switches
  const [v, setV] = useState<V | null>(null)
  const [left, setLeft] = useState(0)
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (window.location.pathname.startsWith('/login') || window.parent !== window) return
    let later = false
    try { later = !!localStorage.getItem(LATER()) } catch { /* private window */ }
    if (later) return
    const t = setTimeout(() => {
      fetch('/api/law-video', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
        const due: V[] = d?.due ?? []
        if (due.length) { setV(due[0]); setLeft(due.length - 1) }
      }).catch(() => {})
    }, 12000)   // after the login law reminder
    return () => clearTimeout(t)
  }, [])
  if (!v) return null
  if (!features.video_gate) return null
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/start-of-day')) return null   // never cover the manager's "Before you continue" page
  const ended = () => {
    setDone(true)
    void fetch('/api/law-video', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area: v.key, label: v.label + ' video' }) }).catch(() => {})
  }
  const later = () => { try { localStorage.setItem(LATER(), '1') } catch { /* ignore */ } setV(null) }
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-3 print:hidden" role="dialog" aria-modal="true">
      <div className="w-full max-w-md space-y-2 rounded-2xl bg-white p-3 shadow-xl">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-indigo-700">Before work · video {v.overdue ? 'overdue' : `due ${v.dueDate}`}</p>
        <p className="text-sm font-bold text-gray-900">Watch the {v.label} video to the end</p>
        <p className="text-[12px] text-gray-600">The law: watch each tile video to the end within 7 days. It counts only when it plays to the end.{left ? ` ${left} more after this one.` : ''}</p>
        <video ref={ref} src={v.src} controls playsInline preload="metadata" onEnded={ended} className="max-h-[55vh] w-full rounded-lg bg-black" />
        {done
          ? <button type="button" onClick={() => setV(null)} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white">Watched. Close</button>
          : <button type="button" onClick={later} className="w-full rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700">Later today (once a day)</button>}
      </div>
    </div>
  )
}
