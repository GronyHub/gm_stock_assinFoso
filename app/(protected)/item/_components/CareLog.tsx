'use client'
import { useState } from 'react'
import { CHILDREN, dayKey } from '@/lib/caretakerShared'
import { hhmm, useCareEvents } from './careUtils'

// Owner view (Grony / Joe): everything Beatrice recorded, by day, newest last,
// with the exact server time of each record.
export default function CareLog() {
  const [date, setDate] = useState(dayKey())
  const [who, setWho] = useState<string>('all')
  const { events, error, refresh } = useCareEvents(date, 120000)
  const shown = events.filter(e => who === 'all' ? true : who === 'house' ? !e.child : e.child === who)
  const counts: Record<string, number> = {}
  for (const e of events) counts[e.child ?? 'house'] = (counts[e.child ?? 'house'] ?? 0) + 1

  return (
    <div className="px-3 pt-3 pb-16 space-y-3 max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold text-gray-900">Care log</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value || dayKey())} className="rounded-lg border border-gray-300 px-2 py-1 text-sm" />
        <button type="button" onClick={() => void refresh()} className="rounded-lg bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700">Refresh</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['all', ...CHILDREN, 'house'].map(w => (
          <button key={w} type="button" onClick={() => setWho(w)}
            className={`rounded-full px-3 py-1 text-xs font-bold ${who === w ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {w === 'all' ? `All (${events.length})` : `${w[0].toUpperCase()}${w.slice(1)} (${counts[w] ?? 0})`}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">Couldn&apos;t load the records. Try Refresh.</p>}
      {!error && shown.length === 0 && <p className="text-sm text-gray-400">No records for this day.</p>}
      <div className="space-y-1.5">
        {shown.map(e => {
          const checks = (e.extra as { checks?: string[] } | null)?.checks
          return (
            <div key={e.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-sm text-gray-900">
                <span className="mr-2 font-mono text-xs text-gray-500">{hhmm(e.recorded_at)}</span>
                <span className="font-semibold">{e.child ?? 'House'}</span> · {e.kind.replace('_', ' ')}{e.value ? ` · ${e.value.replace(/^rule:/, '')}` : ''}
              </p>
              {checks && <p className="text-xs text-indigo-700">{checks.join(', ')}</p>}
              {e.note && <p className="text-xs text-gray-600">{e.note}</p>}
              {e.photo_url && <a href={e.photo_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600">View photo</a>}
              <p className="text-[10px] text-gray-400">by {e.recorded_by}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
