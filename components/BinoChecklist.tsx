'use client'
import { useState } from 'react'

export type BinoChecklistAnswers = {
  advert_new: boolean
  advert_low_performing: boolean
  advert_trending: boolean
  equipment_checked: boolean
  jingle_recorded: boolean
  files_named: boolean
  notes: string | null
}

const TASKS: { key: keyof Omit<BinoChecklistAnswers, 'notes'>; label: string }[] = [
  { key: 'advert_new', label: 'Recorded adverts for any new items/services today' },
  { key: 'advert_low_performing', label: 'Recorded an advert for a low-performing service or good' },
  { key: 'advert_trending', label: 'Recorded an advert for a trending service' },
  { key: 'equipment_checked', label: 'Confirmed Amplifier, Speaker & wires (Monday/Thursday only)' },
  { key: 'jingle_recorded', label: "Recorded this month's new jingle (if not already done)" },
  { key: 'files_named', label: "Named today's audio files by service name" },
]

// Bino's own end-of-day checklist against the Advert rules -- shown every
// time he clocks out so there's a record of what he says he did that day.
export default function BinoChecklist({ saving, onSubmit, onCancel }: {
  saving: boolean
  onSubmit: (answers: BinoChecklistAnswers) => void
  onCancel: () => void
}) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState('')

  function toggle(key: string) {
    setDone(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function submit() {
    onSubmit({
      advert_new: !!done.advert_new,
      advert_low_performing: !!done.advert_low_performing,
      advert_trending: !!done.advert_trending,
      equipment_checked: !!done.equipment_checked,
      jingle_recorded: !!done.jingle_recorded,
      files_named: !!done.files_named,
      notes: notes.trim() || null,
    })
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-4">
        <div>
          <p className="font-bold text-gray-900 text-base">🎯 Today&apos;s Advert Checklist</p>
          <p className="text-xs text-gray-500 mt-0.5">Tick what you actually did today before clocking out.</p>
        </div>

        <div className="space-y-1">
          {TASKS.map(t => (
            <label key={t.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={!!done[t.key]} onChange={() => toggle(t.key)}
                className="w-4 h-4 accent-blue-600 shrink-0" />
              <span className="text-sm text-gray-800">{t.label}</span>
            </label>
          ))}
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder="Anything else worth noting? (optional)"
          className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Submit & Clock Out'}
          </button>
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
