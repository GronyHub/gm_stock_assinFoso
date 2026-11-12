'use client'
import { useEffect, useState } from 'react'
import type { MyDayItem } from '@/lib/myDay'
import { addDays, CHECKLIST_START } from '@/lib/dailyChecksShared'
import DateStrip from '@/components/DateStrip'
import TaskTile, { DensityToggle, tileGrid, useTileDensity } from '@/components/TaskTile'
import MyDayClient from '@/app/(protected)/my-day/MyDayClient'

// Waiting for me: the same date strip as Waiting for team, filtered to one person. Today is their live list; another date holds only their own duties
// for that date (what they did, what they marked not done, what they missed; or what is planned for them).
export default function PersonWaiting({ forName = '', onNavigate }: { forName?: string; onNavigate?: (i: MyDayItem) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const [sel, setSel] = useState(today)
  const [density, setDensity] = useTileDensity()
  const [items, setItems] = useState<MyDayItem[] | null>(null)
  const past: string[] = []
  for (let d = addDays(today, -1); d >= CHECKLIST_START && past.length < 60; d = addDays(d, -1)) past.unshift(d)
  const ahead: string[] = []
  for (let i = 1; i <= 31; i++) ahead.push(addDays(today, i))
  const dates = [...past, today, ...ahead]
  useEffect(() => {
    if (sel === today) return
    let live = true; setItems(null)
    fetch(`/api/my-day?date=${sel}${forName ? `&for=${encodeURIComponent(forName)}` : ''}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live) setItems(d?.items ?? []) }).catch(() => { if (live) setItems([]) })
    return () => { live = false }
  }, [sel, today, forName])
  const done = items?.filter(i => i.state === 'done').length ?? 0, notd = items?.filter(i => i.state === 'not').length ?? 0, miss = items?.filter(i => i.state === 'miss').length ?? 0
  return (
    <div>
      <div className="flex items-start gap-2 px-2 pt-2">
        <DateStrip dates={dates} sel={sel} today={today} onSel={setSel} />
        <DensityToggle density={density} onChange={setDensity} />
      </div>
      {sel === today
        ? <MyDayClient key={`${forName}`} forName={forName} onNavigate={onNavigate} density={density} lens="all" />
        : (
          <div className="space-y-2 p-3">
            {items === null && <p className="text-sm text-gray-400">Loading…</p>}
            {items && items.length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing {sel > today ? 'is planned' : 'fell'} for {forName ? 'this person' : 'you'} on this day.</p>}
            {items && items.length > 0 && sel < today && <p className="text-[11px] text-gray-500">{done} done · {notd} marked not done · {miss} not done at all</p>}
            {items && items.length > 0 && (
              <div className={tileGrid(density)}>
                {items.map(i => (
                  <TaskTile key={i.key} density={density} icon={i.icon} time={i.time} title={i.title} detail={i.detail} who={i.who} category={i.category} type={i.type}
                    mark={i.state === 'done' ? 'done' : i.state === 'not' ? 'no' : i.state === 'miss' ? 'miss' : undefined}
                    tone={i.state === 'done' ? 'border-green-400 bg-green-50' : i.state === 'not' ? 'border-gray-300 bg-gray-100' : i.state === 'miss' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'} />))}
              </div>)}
          </div>)}
    </div>
  )
}
