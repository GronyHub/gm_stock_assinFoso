'use client'
import { fmtOrdinalDate } from '@/lib/fmtDate'
import { SHORT_LABEL, ERRORS_TAB_VIOLATION, DEFAULT_ASSIGNEE, type Violation } from './useViolations'

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

// One line of the Grony Cash / Grony Manage violation lists -- shared so the
// two panels (moved apart in the Grony Cash restructure) render identically.
// "Joe, 2 days left to fix 5 Cash Counts — Do it now →"
export function ViolationRow({ v, assignments, deadlines, assignedBy, assignedOn, vSettings, onGoToViolation, defaultAssignee }: {
  v: Violation
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation?: (key: string) => void
  defaultAssignee?: string
}) {
  const assignedTo = assignments[v.type] ?? defaultAssignee ?? DEFAULT_ASSIGNEE
  const explicitlyAssigned = Boolean(assignments[v.type])
  const deadline = deadlines[v.type]
  const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
  const violationKey = ERRORS_TAB_VIOLATION[v.type] ?? v.type

  const remaining = deadline
    ? -daysSince(deadline)
    : v.type === 'daily'
      ? 0 // the daily count is always due today
      : threshold - (v.days ?? 0)
  const remainingPhrase = remaining > 0
    ? `${remaining} day${remaining !== 1 ? 's' : ''} left to fix`
    : remaining === 0
      ? 'due today to fix'
      : `overdue by ${Math.abs(remaining)} day${Math.abs(remaining) !== 1 ? 's' : ''} to fix`
  const atRisk = remaining < 0
  const on = assignedOn[v.type]
  const by = assignedBy[v.type]

  // Clear types keep the same sentence shape, just with nothing left to fix.
  if (v.count === 0) {
    return (
      <div className="py-[3px] text-[11px] leading-snug text-gray-400">
        <span className="capitalize font-semibold">{assignedTo}</span>, nothing left to fix{' '}
        <span className="font-bold text-green-600">0</span>{' '}
        {SHORT_LABEL[v.type] ?? v.label} <span className="text-green-600">✓</span>{' '}
        <button onClick={() => onGoToViolation?.(violationKey)} className="text-blue-400 font-semibold whitespace-nowrap">
          View →
        </button>
      </div>
    )
  }

  return (
    <div className={`py-[3px] text-[11px] leading-snug ${atRisk ? 'text-red-500' : 'text-gray-700'}`}>
      <span className="capitalize font-semibold">{assignedTo}</span>, {remainingPhrase}{' '}
      <span className="font-bold text-red-500">{v.count}</span>{' '}
      {SHORT_LABEL[v.type] ?? v.label}
      {atRisk && ' ⚠'}{' '}
      <button onClick={() => onGoToViolation?.(violationKey)} className="text-blue-600 font-semibold whitespace-nowrap">
        Do it now →
      </button>
      {explicitlyAssigned && on && (
        <span className="text-gray-400">
          {' '}(TAO {fmtOrdinalDate(on)}{by && <> by <span className="capitalize">{by}</span></>})
        </span>
      )}
    </div>
  )
}
