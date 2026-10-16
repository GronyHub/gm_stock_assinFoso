'use client'
import { useState } from 'react'
import { dayKey } from '@/lib/caretakerShared'
import { hhmm, useCareEvents } from './careUtils'

// Top-down plan of the house, drawn from the owner's description of the
// photos. It is a DRAFT layout: every room is one line in ROOMS below, so a
// correction is a one-line change. Rooms that are part of the daily cleaning
// list (see HOUSE_AREAS) turn green once today's "no cobwebs" tick is recorded.
type Room = { id: string; label: string; x: number; y: number; w: number; h: number; area?: string; note?: string; fill?: string }
const ROOMS: Room[] = [
  { id: 'master', label: 'Master bedroom', x: 20, y: 20, w: 220, h: 180, area: 'Master bedroom', note: 'Between the kitchen and your mother\'s room.' },
  { id: 'masterbath', label: 'Master bath & toilet', x: 20, y: 20, w: 100, h: 80, area: 'Master bath & toilet', note: 'Inside the master bedroom. Bathroom photo needed daily.' },
  { id: 'kitchen', label: 'Kitchen', x: 240, y: 20, w: 240, h: 130, area: 'Kitchen', note: 'Straight ahead at the end of the corridor.' },
  { id: 'mother', label: "Mother's room", x: 20, y: 210, w: 280, h: 180, note: 'Door on the left of the corridor.' },
  { id: 'corridor', label: 'Corridor (L-shaped)', x: 300, y: 150, w: 60, h: 250, area: 'Corridor', note: 'The corridor turns left at the bottom and runs to the exit door.' },
  { id: 'corridor2', label: 'Corridor', x: 20, y: 400, w: 340, h: 60, area: 'Corridor' },
  { id: 'genbath', label: 'General bath & toilet', x: 360, y: 150, w: 110, h: 110, area: 'General bath & toilet', note: 'Door on the right of the corridor. Bathroom photo needed daily.' },
  { id: 'beatrice', label: "Beatrice's room", x: 480, y: 150, w: 200, h: 110, area: "Beatrice's room", note: 'Its door opens onto the living room.' },
  { id: 'living', label: 'Living room', x: 360, y: 270, w: 320, h: 190, area: 'Living room', note: 'The children sleep here. Has its own exit door.' },
  { id: 'joe', label: "Joe's room", x: 20, y: 460, w: 280, h: 100, note: 'Door on the left of the corridor leg.' },
  { id: 'yard', label: 'Outside', x: 480, y: 20, w: 200, h: 120, fill: '#ecfccb', area: 'Outside & exits' },
]
// Doors: [x, y, w, h, isExit]
const DOORS: [number, number, number, number, boolean][] = [
  [296, 300, 8, 36, false],   // mother's room -> corridor
  [356, 190, 8, 36, false],   // general bath
  [356, 320, 8, 40, false],   // living room
  [330, 146, 36, 8, false],   // kitchen (end of corridor)
  [560, 256, 40, 8, false],   // Beatrice's room -> living room
  [676, 340, 8, 50, true],    // living room exit
  [16, 415, 8, 30, true],     // corridor leg exit
  [130, 456, 40, 8, false],   // Joe's room
]

export default function HousePlan() {
  const { events } = useCareEvents(dayKey(), 120000)
  const [sel, setSel] = useState<Room | null>(null)
  const clean = (area?: string) => area ? events.filter(e => e.kind === 'house' && e.value === `rule:clean:${area}`).at(-1) : undefined

  return (
    <div className="max-w-2xl space-y-3 px-3 pb-16 pt-3">
      <h1 className="text-lg font-bold text-gray-900">House plan</h1>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Draft layout drawn from the photos. If a room is in the wrong place, tell Claude which one and it will be moved.</p>
      <svg viewBox="0 0 700 580" className="w-full rounded-xl border border-gray-200 bg-white" role="img" aria-label="Plan of the house">
        {ROOMS.map(r => {
          const done = clean(r.area)
          const fill = r.fill ?? (done ? '#bbf7d0' : r.area ? '#e0f2fe' : '#e5e7eb')
          return (
            <g key={r.id} onClick={() => setSel(r)} className="cursor-pointer">
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} stroke={sel?.id === r.id ? '#2563eb' : '#374151'} strokeWidth={sel?.id === r.id ? 4 : 2} />
              <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" fontSize={r.w < 120 ? 11 : 14} fontWeight={600} fill="#111827">
                {r.label.length > 18 && r.w < 160 ? r.label.split(' ').reduce<string[]>((a, w) => { const l = a[a.length - 1]; if (l && (l + ' ' + w).length <= 14) a[a.length - 1] = l + ' ' + w; else a.push(w); return a }, []).map((ln, i, arr) => (
                  <tspan key={i} x={r.x + r.w / 2} dy={i === 0 ? -(arr.length - 1) * 7 : 15}>{ln}</tspan>
                )) : r.label}
              </text>
            </g>
          )
        })}
        {DOORS.map(([x, y, w, h, exit], i) => <rect key={i} x={x} y={y} width={w} height={h} fill={exit ? '#dc2626' : '#f59e0b'} />)}
        <text x="350" y="575" textAnchor="middle" fontSize="12" fill="#6b7280">Orange = door · Red = exit to outside · Green room = cleaned today (no cobwebs ticked)</text>
      </svg>
      {sel && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-base font-bold text-gray-900">{sel.label}</p>
          {sel.note && <p className="text-sm text-gray-600">{sel.note}</p>}
          {sel.area && (() => {
            const d = clean(sel.area)
            return <p className={`mt-1 text-sm font-semibold ${d ? 'text-green-700' : 'text-gray-500'}`}>{d ? `Cleaned today ✓ ${hhmm(d.recorded_at)}` : 'Not ticked as clean yet today'}</p>
          })()}
        </div>
      )}
    </div>
  )
}
