'use client'
import { useState, useEffect } from 'react'
import SavedFlash from './SavedFlash'

type ActivityRow = { action: string; count: number; durationSeconds: number; isDefault: boolean }

// Formats seconds as a short, editable-friendly minutes string ("1", "1.5",
// "0.5") -- everything on the Home feed and the worked-time banner is shown
// in minutes/hours, and every existing duration in this app (30s, 60s,
// 600s) already lands on a clean minutes value, so there's no need for a
// separate seconds field most owners would never touch.
function secondsToMinutesStr(seconds: number): string {
  const mins = seconds / 60
  return Number.isInteger(mins) ? String(mins) : String(Math.round(mins * 100) / 100)
}

// Reached from Settings -- lets an owner-level account set how long each
// kind of logged activity counts as taking, for the Home feed's Duration/
// Total columns and the staff-time banner's worked-time figure (see
// lib/workedDuration.ts's own comment: every activity that doesn't compute
// a real duration itself, e.g. a live sale tap does, otherwise falls back
// to one shared default until it's given its own row here).
export default function ActivityDurationsPanel() {
  const [actions, setActions] = useState<ActivityRow[]>([])
  const [defaultSeconds, setDefaultSeconds] = useState(60)
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingAction, setSavingAction] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    fetch('/api/activity-durations').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.actions) {
        setActions(d.actions)
        setDrafts(Object.fromEntries((d.actions as ActivityRow[]).map(a => [a.action, secondsToMinutesStr(a.durationSeconds)])))
      }
      if (d?.defaultSeconds != null) setDefaultSeconds(d.defaultSeconds)
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function save(action: string) {
    const raw = drafts[action]
    const minutes = parseFloat(raw)
    if (!raw || isNaN(minutes) || minutes < 0) { setError(`"${action}" needs a valid number of minutes (0 or more).`); return }
    setSavingAction(action)
    setError('')
    const res = await fetch('/api/activity-durations', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, durationSeconds: Math.round(minutes * 60) }),
    })
    setSavingAction(null)
    if (res.ok) {
      setActions(prev => prev.map(a => a.action === action ? { ...a, durationSeconds: Math.round(minutes * 60), isDefault: false } : a))
      setJustSaved(action)
      setTimeout(() => setJustSaved(prev => prev === action ? null : prev), 2000)
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save. Please try again.')
    }
  }

  async function resetToDefault(action: string) {
    setSavingAction(action)
    setError('')
    const res = await fetch('/api/activity-durations', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, durationSeconds: null }),
    })
    setSavingAction(null)
    if (res.ok) {
      setActions(prev => prev.map(a => a.action === action ? { ...a, durationSeconds: defaultSeconds, isDefault: true } : a))
      setDrafts(prev => ({ ...prev, [action]: secondsToMinutesStr(defaultSeconds) }))
    } else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not reset. Please try again.')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold text-gray-900">Activity Times</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          How long each kind of logged activity counts as taking, for the Home feed's Duration/Total
          columns and everyone's worked-time figure. A live sale tap always calculates its own real
          duration and ignores this; everything else uses whatever's set here, or {secondsToMinutesStr(defaultSeconds)}{' '}
          minute{defaultSeconds !== 60 ? 's' : ''} by default if it's never been set.
        </p>
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-6">Loading…</p>
      ) : actions.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">No activity has been logged yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {actions.map(a => (
            <div key={a.action} className="flex items-center gap-2 px-3 py-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 capitalize truncate">{a.action}</p>
                <p className="text-[10px] text-gray-400">
                  {a.count} time{a.count !== 1 ? 's' : ''} logged{a.isDefault ? ' · using the default' : ''}
                </p>
              </div>
              <input type="number" min="0" step="0.5" value={drafts[a.action] ?? ''}
                onChange={e => setDrafts(prev => ({ ...prev, [a.action]: e.target.value }))}
                className="w-16 text-right bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
              <span className="text-[10px] text-gray-400 shrink-0">min</span>
              <button onClick={() => save(a.action)} disabled={savingAction === a.action}
                className="text-[10px] font-semibold text-white bg-blue-600 px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-40 shrink-0">
                Save
              </button>
              {!a.isDefault && (
                <button onClick={() => resetToDefault(a.action)} disabled={savingAction === a.action}
                  title="Go back to the default" className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 shrink-0">
                  Reset
                </button>
              )}
              {justSaved === a.action && <SavedFlash show />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
