'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import CloserQuestionnaire, { ClosingAnswers } from '@/components/CloserQuestionnaire'
import BinoChecklist, { BinoChecklistAnswers } from '@/components/BinoChecklist'

export type Mine = {
  actual_in: string | null; actual_out: string | null
  opening_count_confirmed?: boolean; in_source?: string | null; out_source?: string | null
  on_break?: boolean
} | null

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400'
const labelCls = 'text-xs text-gray-400 font-medium mb-1 block'

// Ghana runs on UTC year-round with no DST, so "now in Ghana" is just UTC
// now -- using getUTCHours/getUTCMinutes here (instead of the device's own
// local getters) means a clock-in recorded from a phone set to any other
// timezone still lands on the correct Ghana wall-clock time.
function nowAsHHMM() {
  const d = new Date()
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}
function hhmmTo12h(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  let h = parseInt(hStr, 10)
  const m = mStr
  const suffix = h >= 12 ? 'pm' : 'am'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m}${suffix}`
}
function nowAs12h(): string {
  return hhmmTo12h(nowAsHHMM())
}

// A dot next to a clock time shows how it got there: green for the actual
// Clock In/Out button (GPS-verified), red for a manual adjustment (the "+
// Add Entry"/edit forms, see /api/staff-times/entry and entry-id). No dot
// for older rows recorded before this distinction existed -- there's no way
// to know their origin, so guessing would mislead.
function SourceDot({ source }: { source?: string | null }) {
  if (source === 'clock') return <span title="Clocked with the button" className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 ml-1 align-middle" />
  if (source === 'manual') return <span title="Manually adjusted" className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-1 align-middle" />
  return null
}

function getLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Your browser does not support location services.'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true, timeout: 15000, maximumAge: 0,
    })
  })
}

// Self-service Clock In/Out (GPS-gated), the Opener/Closer flows it triggers
// (opening-count confirmation banner, the Closer's questionnaire, Bino's
// Advert checklist), and the on_break toggle -- one shared component so
// there's exactly one copy of these rules to keep correct, no matter which
// screen it's shown on. Originally lived only inside Team Times
// (StaffClient.tsx's TimesTab, still its main home -- gated there to
// isOwnPage, since clocking someone else in from their own page would be
// wrong); also embedded in StaffTimesView's "Times" tab on a staff member's
// own personal page, again only when viewing yourself, as a shortcut so you
// don't have to leave wherever you are to clock in.
//
// Fully "controlled": today's clock state (`mine`) and who's today's Opener
// (`opener`) are read from props, not fetched here -- each caller already
// has its own reason to know today's staff-times state (TimesTab's shared
// grid needs it regardless; StaffTimesView fetches it itself for its own
// day view) and passing that in avoids a second, redundant fetch of the
// same data on the one screen (Team Times) where this panel and that other
// consumer are both mounted together. `onMineChange` is meant to be the
// caller's own `setMine` state setter directly -- its shape (accepts either
// a new value or an updater function) is exactly a useState setter's.
export default function ClockInOutPanel({
  username, mine, opener, onMineChange, afterAction, onPickingTimeChange,
}: {
  username: string
  mine: Mine
  opener: string | null
  onMineChange: (value: Mine | ((prev: Mine) => Mine)) => void
  afterAction?: () => void
  // Team Times' own background poll pauses while this is true, same as it
  // already pauses while editing a row in the shared grid -- otherwise a
  // refresh landing mid-pick could feel like it yanked the picker away.
  onPickingTimeChange?: (picking: boolean) => void
}) {
  const [pickingTime, setPickingTime] = useState(false)
  useEffect(() => { onPickingTimeChange?.(pickingTime) }, [pickingTime]) // eslint-disable-line react-hooks/exhaustive-deps
  const [customTime, setCustomTime] = useState(nowAsHHMM())
  const [saving, setSaving] = useState(false)
  const [savingBreak, setSavingBreak] = useState(false)
  const [err, setErr] = useState('')
  const [roleBanner, setRoleBanner] = useState<string | null>(null)
  const [closerPrompt, setCloserPrompt] = useState<{ time: string; present: string[] } | null>(null)
  const [confirmingCount, setConfirmingCount] = useState(false)
  const [confirmCountErr, setConfirmCountErr] = useState('')
  const [binoChecklistOpen, setBinoChecklistOpen] = useState(false)
  const [binoChecklistSaving, setBinoChecklistSaving] = useState(false)
  const isBino = username.toLowerCase() === 'bino'

  async function clock(action: 'in' | 'out', opts?: { time?: string; closingReport?: ClosingAnswers }) {
    const time = opts?.time ?? (pickingTime ? hhmmTo12h(customTime) : nowAs12h())
    setErr('')
    setRoleBanner(null)
    setSaving(true)

    let latitude: number | null = null, longitude: number | null = null, accuracy: number | null = null
    try {
      const pos = await getLocation()
      latitude = pos.coords.latitude
      longitude = pos.coords.longitude
      accuracy = pos.coords.accuracy
    } catch (e: any) {
      setSaving(false)
      if (e?.code === 1) setErr('Location access was denied. Please enable location services for this site and try again.')
      else setErr(e?.message || 'Could not get your location. Make sure GPS is turned on and try again.')
      return
    }

    const res = await fetch('/api/staff-times/today', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, time, latitude, longitude, accuracy, closing_report: opts?.closingReport }),
    })
    setSaving(false)
    if (res.ok) {
      const updated = await res.json()
      onMineChange(updated)
      setPickingTime(false)
      setCustomTime(nowAsHHMM())
      setCloserPrompt(null)
      if (updated.is_opener) setRoleBanner('🌅 You are the Opener for today! Confirm the opening counts below to finish clocking in.')
      else if (updated.is_closer) setRoleBanner('🌙 You are the Closer for today — closing report received. Thank you, and good night!')
      afterAction?.()
    } else {
      const d = await res.json().catch(() => ({}))
      if (res.status === 409 && d.requires_closing_report) {
        // Last one out — show the closing questionnaire, then retry with answers.
        setCloserPrompt({ time, present: Array.isArray(d.present_staff) ? d.present_staff : [] })
      } else {
        setErr(d.error || 'Failed to save')
      }
    }
  }

  // Toggles the display-only on_break flag (see /api/staff-times/break) --
  // no GPS check, unlike clock() itself, since it doesn't create or move a
  // clock-in/out record, just marks the one already in place. Only shown
  // while actually clocked in for the day (see the button below).
  async function toggleBreak() {
    setSavingBreak(true)
    const res = await fetch('/api/staff-times/break', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on_break: !mine?.on_break }),
    })
    setSavingBreak(false)
    if (res.ok) {
      const updated = await res.json()
      onMineChange(prev => prev ? { ...prev, on_break: updated.on_break } : prev)
    } else {
      const d = await res.json().catch(() => ({}))
      setErr(d.error || 'Failed to save')
    }
  }

  // The Opener's clock-in time is recorded immediately (never delayed), but
  // it doesn't count as fully complete until they confirm today's daily
  // counts -- gated here, not at clock-in time itself.
  const amOpenerToday = !!opener && opener === username
  const needsOpeningCount = amOpenerToday && !!mine?.actual_in && !mine?.opening_count_confirmed

  async function confirmOpeningCount() {
    setConfirmingCount(true)
    setConfirmCountErr('')
    const res = await fetch('/api/staff-times/opening-count', { method: 'POST' })
    setConfirmingCount(false)
    if (res.ok) {
      onMineChange(prev => prev ? { ...prev, opening_count_confirmed: true } : prev)
      setRoleBanner('✅ Opening counts confirmed — your clock-in is complete!')
    } else {
      const d = await res.json().catch(() => ({}))
      setConfirmCountErr(d.error || 'Could not confirm — try again.')
    }
  }

  // Bino's Advert checklist is shown every time he clocks out -- saved
  // first, then the actual clock-out proceeds as normal.
  async function submitBinoChecklist(answers: BinoChecklistAnswers) {
    setBinoChecklistSaving(true)
    await fetch('/api/staff-times/bino-checklist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(answers),
    }).catch(() => {})
    setBinoChecklistSaving(false)
    setBinoChecklistOpen(false)
    clock('out')
  }

  return (
    <>
      {/* Closer questionnaire — shown when this user is the last to clock out */}
      {closerPrompt && (
        <CloserQuestionnaire
          presentStaff={closerPrompt.present}
          saving={saving}
          onSubmit={answers => clock('out', { time: closerPrompt.time, closingReport: answers })}
          onCancel={() => setCloserPrompt(null)}
        />
      )}
      {/* Bino's Advert checklist — shown every time he clocks out */}
      {binoChecklistOpen && (
        <BinoChecklist
          saving={binoChecklistSaving}
          onSubmit={submitBinoChecklist}
          onCancel={() => setBinoChecklistOpen(false)}
        />
      )}

      {roleBanner && (
        <div className="flex items-start justify-between gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-blue-800">{roleBanner}</p>
          <button onClick={() => setRoleBanner(null)} className="text-blue-300 hover:text-blue-500 font-bold leading-none">×</button>
        </div>
      )}

      {/* Opener's clock-in is compulsory-gated on the daily counts -- the
          time is already saved (see clock()/roleBanner above), but it isn't
          fully complete until this is confirmed. Stays up on every visit
          until confirmed, not just right after clocking in. */}
      {needsOpeningCount && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-800">🌅 You&apos;re the Opener today</p>
          <p className="text-xs text-amber-700">
            Your clock-in time is saved, but it isn&apos;t complete until you confirm today&apos;s opening counts.
          </p>
          {confirmCountErr && <p className="text-xs text-red-600">{confirmCountErr}</p>}
          <div className="flex gap-2">
            <Link href="/item?tab=errors&violation=daily"
              className="flex-1 text-center bg-white border border-amber-300 text-amber-800 text-xs font-semibold rounded-lg py-2 hover:bg-amber-100 transition">
              Go to Counts →
            </Link>
            <button onClick={confirmOpeningCount} disabled={confirmingCount}
              className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition">
              {confirmingCount ? 'Checking…' : "I've Completed the Counts"}
            </button>
          </div>
        </div>
      )}

      {/* Clock In/Out panel */}
      <div className="bg-white border border-gray-200 rounded-xl p-2.5 space-y-2">
        <p className="text-xs font-semibold text-gray-700">My Time Today</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-green-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400 block">Time In</span>
            <span className="font-semibold text-green-700">{mine?.actual_in ?? '—'}<SourceDot source={mine?.in_source} /></span>
            {needsOpeningCount && <span className="text-[9px] text-amber-600 font-semibold block mt-0.5">Pending opening count</span>}
          </div>
          <div className="bg-orange-50 rounded-lg px-2.5 py-1.5">
            <span className="text-[10px] text-gray-400 block">Time Out</span>
            <span className="font-semibold text-orange-600">{mine?.actual_out ?? '—'}<SourceDot source={mine?.out_source} /></span>
          </div>
        </div>

        {!pickingTime ? (
          <button onClick={() => setPickingTime(true)}
            className="w-full text-center text-xs text-blue-600 font-medium py-0.5">
            Not now? Tap to pick a different time →
          </button>
        ) : (
          <div className="space-y-1.5">
            <label className={labelCls}>Time to record</label>
            <div className="flex items-center gap-2">
              <input type="time" value={customTime} onChange={e => setCustomTime(e.target.value)}
                className={inputCls + ' flex-1'} />
              <button onClick={() => setPickingTime(false)}
                className="shrink-0 text-xs text-gray-400 font-medium px-2 py-2.5">
                Use now
              </button>
            </div>
          </div>
        )}

        {err && <p className="text-xs text-red-500">{err}</p>}
        <div className="flex gap-2">
          <button onClick={() => clock('in')} disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2 transition">
            {saving ? '…' : `Clock In${pickingTime ? '' : ' (Now)'}`}
          </button>
          <button onClick={() => isBino ? setBinoChecklistOpen(true) : clock('out')} disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2 transition">
            {saving ? '…' : `Clock Out${pickingTime ? '' : ' (Now)'}`}
          </button>
        </div>
        {/* Only makes sense once actually clocked in for the day, and not
            after clocking out again -- see /api/staff-times/break's own
            comment on why this is a separate, lighter action than clock(). */}
        {mine?.actual_in && !mine?.actual_out && (
          <button onClick={toggleBreak} disabled={savingBreak}
            className={`w-full text-sm font-semibold rounded-xl py-2 transition disabled:opacity-40 ${
              mine?.on_break ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}>
            {savingBreak ? '…' : (mine?.on_break ? 'End Break' : 'Take a Break')}
          </button>
        )}
        <p className="text-[10px] text-gray-400 text-center">📍 Location must be enabled — you must be at the shop to clock in/out.</p>
      </div>
    </>
  )
}
