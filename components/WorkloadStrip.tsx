'use client'
import { useEffect, useState } from 'react'

type P = { name: string; shift: number; target: number; assigned: number; done: number; short: number }
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`)
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// The workload rule, shown for the chosen day: the tasks that fall on each person should add up to at least half of the time they are at the shop.
export default function WorkloadStrip({ date }: { date: string }) {
  const [people, setPeople] = useState<P[] | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/workload?date=${date}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(d => { if (live) setPeople(Array.isArray(d?.people) ? d.people : []) }).catch(() => { if (live) setPeople([]) })
    return () => { live = false }
  }, [date])
  if (!people || people.length === 0) return null
  return (
    <details className="rounded-xl border border-gray-200 bg-white" open>
      <summary className="cursor-pointer px-3 py-2 text-[13px] font-semibold text-gray-900">Workload: tasks should fill at least half of each person&apos;s time</summary>
      <div className="space-y-2 px-3 pb-3">
        {people.map(p => {
          const pct = p.target > 0 ? Math.min(100, Math.round((p.assigned / p.target) * 100)) : 100
          const enough = p.assigned >= p.target
          return (
            <div key={p.name}>
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="font-semibold text-gray-900">{cap(p.name)}</span>
                <span className={enough ? 'text-green-700' : 'font-semibold text-red-700'}>{hm(p.assigned)} of {hm(p.target)} needed</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full ${enough ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} /></div>
              <p className="mt-0.5 text-[12px] text-gray-500">At the shop {hm(p.shift)}; half is {hm(p.target)}. Done so far {hm(p.done)}.{enough ? '' : ` ${hm(p.short)} more work needs to be assigned.`}</p>
            </div>
          )
        })}
      </div>
    </details>
  )
}
