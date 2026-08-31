'use client'
import { useState } from 'react'

function nowAsHHMM(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// staff_times.actual_in is stored as "9:15am"/"2:30pm" (see lib/staffTimes.ts's
// parseTimeMins) -- both the live "now" and a picked <input type="time">
// value need converting to that shape before POSTing.
function to12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  let h = parseInt(hStr, 10)
  const ap = h >= 12 ? 'pm' : 'am'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${mStr}${ap}`
}

function getLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Your browser does not support location services.')); return }
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

// Blocks a sale tap for a staff member who hasn't clocked in today (see
// item/page.tsx's recordTap) -- a reminder, not a hard requirement: they can
// clock in right here (GPS-verified, same as the Team > Times panel's own
// Clock In button) with either the current time or a picked one, or just
// dismiss it and continue without clocking in at all.
export default function ClockInGateModal({ onClockedIn, onSkip }: { onClockedIn: () => void; onSkip: () => void }) {
  const [pickingTime, setPickingTime] = useState(false)
  const [customTime, setCustomTime] = useState(nowAsHHMM())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function clockIn() {
    setSaving(true)
    setErr('')
    const time = pickingTime ? to12h(customTime) : to12h(nowAsHHMM())

    let latitude: number, longitude: number
    try {
      const pos = await getLocation()
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {
      setErr('Enable location services to clock in.')
      setSaving(false)
      return
    }

    try {
      const res = await fetch('/api/staff-times/today', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'in', time, latitude, longitude }),
      })
      setSaving(false)
      if (res.ok) { onClockedIn(); return }
      const d = await res.json().catch(() => ({}))
      setErr(d.error || 'Could not clock in. Please try again.')
    } catch {
      setSaving(false)
      setErr('Could not clock in. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onSkip}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-xs p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">You haven't clocked in today</p>
          <p className="text-xs text-gray-500 mt-0.5">Clock in now so your hours get tracked, or continue without it.</p>
        </div>
        {pickingTime && (
          <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
        )}
        {err && <p className="text-xs text-red-600 font-medium">{err}</p>}
        <div className="flex flex-col gap-1.5">
          <button onClick={clockIn} disabled={saving}
            className="w-full bg-blue-600 text-white text-sm font-bold rounded-lg py-2 disabled:opacity-40">
            {saving ? 'Clocking in…' : `Clock In${pickingTime ? '' : ' (Now)'}`}
          </button>
          <button onClick={() => setPickingTime(p => !p)} className="text-xs font-semibold text-blue-600 py-0.5">
            {pickingTime ? 'Use the current time instead' : 'Pick a different time'}
          </button>
          <button onClick={onSkip}
            className="w-full bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg py-2 hover:bg-gray-200">
            Continue without clocking in
          </button>
        </div>
      </div>
    </div>
  )
}
