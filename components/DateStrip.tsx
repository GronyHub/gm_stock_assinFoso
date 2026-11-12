'use client'
import { useEffect, useRef } from 'react'

// The strip of small date tiles that runs across the top of Waiting for team and Waiting for me: earlier days to the left, Today highlighted, days ahead to the right.
export default function DateStrip({ dates, sel, today, onSel, more }: { dates: string[]; sel: string; today: string; onSel: (d: string) => void; more?: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.querySelector('[data-today="1"]')?.scrollIntoView({ inline: 'start', block: 'nearest' }) }, [])
  return (
    <div ref={ref} className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Pick a date">
      {dates.map(d => {
        const dt = new Date(d + 'T00:00:00Z'), on = sel === d, isT = d === today, isPast = d < today
        return (
          <button key={d} type="button" role="tab" aria-selected={on} data-today={isT ? '1' : undefined} onClick={() => onSel(d)}
            title={dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })}
            className={`flex w-9 shrink-0 select-none flex-col items-center rounded-md border py-0.5 leading-none ${on ? 'border-[#14213D] bg-[#14213D] text-white' : isT ? 'border-blue-500 bg-blue-50 text-gray-800' : isPast ? 'border-gray-200 bg-gray-50 text-gray-500' : 'border-gray-300 bg-white text-gray-800'}`}>
            <span className={`text-[7px] font-bold uppercase ${on ? 'text-blue-200' : 'text-gray-500'}`}>{isT ? 'Today' : dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</span>
            <span className="text-[13px] font-extrabold">{dt.getUTCDate()}</span>
            <span className={`text-[7px] font-bold ${on ? 'text-blue-200' : 'text-gray-400'}`}>{dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
          </button>)
      })}
      {more && <button type="button" onClick={more} title="Show more days" className="flex w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-gray-300 text-[10px] font-bold text-gray-500">+31</button>}
    </div>
  )
}
