'use client'
import { useState, useEffect } from 'react'
import { RoleFlagsTable } from './RoleFlagsTable'
import type { Violation } from './useViolations'

// The opener's own accountability view -- the morning stock count
// confirmation, plus real disciplinary records for past days it was missed.
// Extracted from the old Role Bar's Opener panel into a left-pane item of
// its own inside Grony Manage.
export default function OpenerView({
  violations, assignments, deadlines, assignedBy, assignedOn, vSettings, onGoToViolation,
}: {
  violations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation: (key: string) => void
}) {
  const [today, setToday] = useState<{ opener: string | null; openerConfirmed: boolean | null }>({ opener: null, openerConfirmed: null })
  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }, [])

  // Real disciplinary records (see /api/violations/auto-check) for days the
  // opener didn't finish the required daily counts. Filtered client-side
  // from the same list the Staff > Disciplinary tab reads, rather than a
  // dedicated endpoint. The label must match OPENER_VIOLATION_LABEL in that
  // route exactly.
  const [openerPenalties, setOpenerPenalties] = useState<{ id: number; staff_name: string; details: string; points: number }[] | null>(null)
  useEffect(() => {
    fetch('/api/staff/violations')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOpenerPenalties(Array.isArray(d)
        ? d.filter((v: { violation: string }) => v.violation === 'Missed daily opener counts').slice(0, 10)
        : []))
      .catch(() => setOpenerPenalties([]))
  }, [])

  const openerCount = today.opener && !today.openerConfirmed ? 1 : 0

  return (
    <div className="px-4 py-2 space-y-2">
      <RoleFlagsTable violations={violations} assignments={assignments} deadlines={deadlines}
        assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
        onGoToViolation={key => onGoToViolation(key)} />
      {openerCount === 0 && (
        <p className="text-sm text-gray-400 py-4">
          {today.opener
            ? <>✓ <span className="capitalize">{today.opener}</span> has confirmed today&apos;s opening count.</>
            : 'Nobody has clocked in yet today.'}
        </p>
      )}
      {openerPenalties && openerPenalties.length > 0 && (
        <div className="border border-red-200 rounded-lg overflow-hidden">
          <p className="text-xs font-bold text-red-700 bg-red-50 px-3 py-2 border-b border-red-200">
            Penalty Points — Opener
          </p>
          <div className="divide-y divide-gray-100">
            {openerPenalties.map(v => (
              <div key={v.id} className="px-3 py-2 text-xs flex items-start justify-between gap-2">
                <p className="text-gray-700">
                  <span className="font-semibold capitalize text-gray-900">{v.staff_name}</span>
                  <span> — {v.details}</span>
                </p>
                {v.points > 0 && <span className="shrink-0 text-red-600 font-semibold whitespace-nowrap">-{v.points} pts</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
