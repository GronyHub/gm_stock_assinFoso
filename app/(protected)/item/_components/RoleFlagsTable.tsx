'use client'
import { Fragment, useState } from 'react'
import { fmtOrdinalDate } from '@/lib/fmtDate'
import { SHORT_LABEL, ERRORS_TAB_VIOLATION, type Violation } from './useViolations'
import ViolationFixPanel from './ViolationFixPanel'

type Item = {
  id: number
  item_name: string
  cf_group: string | null
  selling_rate: string | null
  purchase_rate: string | null
  units_per_pack: string | null
  unit_name: string | null
  product_type: string
  calculated_soh: number
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function addDaysStr(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dueCell(v: Violation, deadline: string | undefined, threshold: number): { label: string; atRisk: boolean } {
  if (v.count === 0) return { label: '—', atRisk: false }
  let remaining: number
  let expiry: string
  if (deadline) {
    remaining = -daysSince(deadline)
    expiry = deadline
  } else if (v.type === 'daily') {
    remaining = 0
    expiry = addDaysStr(0)
  } else if (v.days !== null) {
    remaining = threshold - v.days
    expiry = addDaysStr(remaining)
  } else {
    return { label: '—', atRisk: false }
  }
  const atRisk = remaining < 0
  const days = remaining > 0 ? `${remaining}d left` : remaining === 0 ? 'due today' : `overdue ${Math.abs(remaining)}d`
  return { label: `${fmtOrdinalDate(expiry)} · ${days}`, atRisk }
}

// Flag data as a table instead of repeated "Name, X days left to fix..."
// sentences -- the panel title already says whose flags these are, so rows
// don't need to repeat it. One row per flag type: how many, when it's due,
// and (if explicitly assigned) who assigned it and when.
//
// Two click modes: pass `items`+`onItemsChanged` (Joe's panel) and a row
// click expands an inline accordion showing that violation's own fix view
// (reused from whichever tab already renders it) directly in place, with no
// navigation. Omit them (Bino/Opener) and a row click falls back to
// `onGoToViolation`, navigating to that violation's home tab as before.
export function RoleFlagsTable({ violations, assignments, deadlines, assignedBy, assignedOn, vSettings, onGoToViolation, items, onItemsChanged }: {
  violations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation?: (key: string) => void
  items?: Item[]
  onItemsChanged?: (items: Item[]) => void
}) {
  const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
  const inlineFix = items !== undefined && onItemsChanged !== undefined
  const [expandedType, setExpandedType] = useState<string | null>(null)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-[11px] border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-2 py-1.5 font-semibold text-gray-500">Flag Type</th>
            <th className="text-center px-1.5 py-1.5 font-semibold text-gray-500">Count</th>
            <th className="text-left px-1.5 py-1.5 font-semibold text-gray-500">Due</th>
            <th className="text-left px-1.5 py-1.5 font-semibold text-gray-500">Assigned</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {violations.map(v => {
            const { label: dueLabel, atRisk } = dueCell(v, deadlines[v.type], threshold)
            const explicitlyAssigned = !!assignments[v.type]
            const violationKey = ERRORS_TAB_VIOLATION[v.type] ?? v.type
            const isOpen = expandedType === v.type

            return (
              <Fragment key={v.type}>
                <tr
                  onClick={() => inlineFix ? setExpandedType(isOpen ? null : v.type) : onGoToViolation?.(violationKey)}
                  className={`cursor-pointer hover:bg-blue-50 transition ${atRisk ? 'bg-red-50' : ''} ${isOpen ? 'bg-blue-50' : ''}`}>
                  <td className={`px-2 py-1.5 ${v.count > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{SHORT_LABEL[v.type] ?? v.label}</td>
                  <td className={`px-1.5 py-1.5 text-center font-bold ${v.count > 0 ? (atRisk ? 'text-red-600' : 'text-gray-900') : 'text-green-600'}`}>
                    {v.count > 0 ? v.count : '✓'}
                  </td>
                  <td className={`px-1.5 py-1.5 whitespace-nowrap ${atRisk ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>{dueLabel}</td>
                  <td className="px-1.5 py-1.5 text-gray-500 whitespace-nowrap">
                    {explicitlyAssigned && assignedOn[v.type] ? (
                      <>{fmtOrdinalDate(assignedOn[v.type])}{assignedBy[v.type] && <> by <span className="capitalize">{assignedBy[v.type]}</span></>}</>
                    ) : '—'}
                  </td>
                </tr>
                {inlineFix && isOpen && (
                  <tr>
                    <td colSpan={4} className="p-0 border-t border-gray-200 bg-white">
                      <div className="max-h-[60vh] overflow-auto">
                        <ViolationFixPanel type={v.type} items={items!} onItemsChanged={onItemsChanged!} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
