'use client'
import { useEffect, useState } from 'react'
import type { MyDayItem } from '@/lib/myDay'

const TONE = { now: 'border-red-300 bg-red-50', soon: 'border-amber-300 bg-amber-50', later: 'border-gray-200 bg-white' } as const
const TAG = { now: 'Now', soon: 'Today', later: 'When you can' } as const

// Waiting for me: everything the signed-in person owes or must decide, from every part of the app, most urgent first.
export default function MyDayClient() {
  const [items, setItems] = useState<MyDayItem[] | null>(null)
  const load = () => fetch('/api/my-day', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setItems(d?.items ?? [])).catch(() => setItems([]))
  useEffect(() => { void load() }, [])
  const go = (i: MyDayItem) => { if (i.hub) window.parent.postMessage({ type: 'open-personal', tab: i.hub }, window.location.origin); else if (i.href) window.location.href = i.href }
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold text-[#14213D]">Waiting for me</h1>
        <button type="button" onClick={() => void load()} className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">Refresh</button>
      </div>
      <p className="text-sm text-gray-700">Everything you owe or must decide, from every part of the app, most urgent first.</p>
      {items === null && <p className="text-sm text-gray-500">Loading…</p>}
      {items && !items.length && <p className="rounded-xl bg-green-50 p-3 text-sm font-bold text-green-800">✅ Nothing is waiting for you.</p>}
      {items?.map(i => (
        <div key={i.key} className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${TONE[i.urgency]}`}>
          <span className="text-2xl">{i.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-gray-900">{i.title} <span className="ml-1 rounded-full bg-[#14213D] px-2 py-0.5 text-[10px] font-bold text-white">{i.count}</span> <span className="ml-1 text-[10px] font-bold uppercase text-gray-500">{TAG[i.urgency]}</span></p>
            <p className="text-xs text-gray-700">{i.detail}</p>
          </div>
          {(i.href || i.hub) && <button type="button" onClick={() => go(i)} className="shrink-0 rounded-xl bg-[#14213D] px-3 py-2 text-xs font-bold text-white">Open</button>}
        </div>))}
    </div>
  )
}
