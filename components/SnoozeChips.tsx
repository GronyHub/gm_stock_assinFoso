'use client'
import { snooze } from '@/lib/snooze'

export const SNOOZE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '30 min', minutes: 30 }, { label: '1 hour', minutes: 60 }, { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 }, { label: '8 hours', minutes: 480 }, { label: '12 hours', minutes: 720 },
]

// "Remind me in..." with a choice from 30 minutes to 12 hours. Tapping one puts the prompt off for that long (stored on this phone) and closes it.
export default function SnoozeChips({ storageKey, onDone, title = 'Not now: remind me in' }: { storageKey: string; onDone: () => void; title?: string }) {
  return (
    <div className="rounded-xl bg-gray-100 p-2">
      <p className="mb-1 text-center text-[12px] font-bold text-gray-600">{title}</p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {SNOOZE_OPTIONS.map(o => (
          <button key={o.minutes} type="button" onClick={() => { snooze(storageKey, o.minutes); onDone() }}
            className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-gray-800 shadow-sm active:bg-gray-200">{o.label}</button>))}
      </div>
    </div>
  )
}
