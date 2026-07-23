'use client'
import { useState, useEffect, useMemo } from 'react'
import { RoleFlagsTable } from './RoleFlagsTable'
import { LossSummaryTable } from './LossSummaryTable'
import type { Violation } from './useViolations'
import type { RoleKey } from './RoleBar'

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

type Props = {
  role: RoleKey
  cashViolations: Violation[]
  manageViolations: Violation[]
  openerViolations: Violation[]
  assignments: Record<string, string>
  deadlines: Record<string, string>
  assignedBy: Record<string, string>
  assignedOn: Record<string, string>
  vSettings: Record<string, string>
  onGoToViolation: (key: string) => void
  missingClosingReportsCount: number
  onOpenManage: () => void
  onClose: () => void
  items: Item[]
  onItemsChanged: (items: Item[]) => void
}

// Whichever Role Bar tab is open, its flagged items fill the content area
// (below the top menu, above the Role Bar itself) the same way switching a
// top-level tab does -- not a modal, so the bar stays visible/clickable and
// there's a plain Close button instead of a small ×.
export default function RolePanel({
  role, cashViolations, manageViolations, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings,
  onGoToViolation, missingClosingReportsCount, onOpenManage, onClose, items, onItemsChanged,
}: Props) {
  const [today, setToday] = useState<{ opener: string | null; openerConfirmed: boolean | null }>({ opener: null, openerConfirmed: null })
  useEffect(() => {
    fetch('/api/staff-times/today')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setToday({ opener: d.opener ?? null, openerConfirmed: d.openerConfirmed ?? null }) })
      .catch(() => {})
  }, [])

  // Loss-feed summaries for Joe -- all-time, yesterday, this week (Mon-start),
  // this month, this year. Amounts use the Loss menu's valuation.
  const [lossEvents, setLossEvents] = useState<{ date: string; loss_amt: number }[] | null>(null)
  useEffect(() => {
    if (role !== 'joe') return
    fetch('/api/losses/events')
      .then(r => r.ok ? r.json() : [])
      .then(d => setLossEvents(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [role])

  const lossSummary = useMemo(() => {
    if (!lossEvents) return null
    const fmtLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const today0 = new Date(); today0.setHours(0, 0, 0, 0)
    const y = new Date(today0); y.setDate(y.getDate() - 1)
    const weekStart = new Date(today0); weekStart.setDate(weekStart.getDate() - ((today0.getDay() + 6) % 7))
    const monthStart = `${today0.getFullYear()}-${String(today0.getMonth() + 1).padStart(2, '0')}-01`
    const yearStart = `${today0.getFullYear()}-01-01`
    const yesterday = fmtLocal(y), ws = fmtLocal(weekStart)
    const agg = (pred: (d: string) => boolean) => {
      const list = lossEvents.filter(e => pred(e.date))
      return { n: list.length, amt: parseFloat(list.reduce((s, e) => s + (Number(e.loss_amt) || 0), 0).toFixed(2)) }
    }
    return {
      total: agg(() => true),
      yesterday: agg(d => d === yesterday),
      week: agg(d => d >= ws),
      month: agg(d => d >= monthStart),
      year: agg(d => d >= yearStart),
    }
  }, [lossEvents])

  // Opener accountability -- real disciplinary records (see
  // /api/violations/auto-check) for days the opener didn't finish the
  // required daily counts. Filtered client-side from the same list the
  // Staff > Disciplinary tab reads, rather than a dedicated endpoint.
  // The label must match OPENER_VIOLATION_LABEL in that route exactly.
  const [openerPenalties, setOpenerPenalties] = useState<{ id: number; staff_name: string; details: string; points: number }[] | null>(null)
  useEffect(() => {
    if (role !== 'opener') return
    fetch('/api/staff/violations')
      .then(r => r.ok ? r.json() : [])
      .then(d => setOpenerPenalties(Array.isArray(d)
        ? d.filter((v: { violation: string }) => v.violation === 'Missed daily opener counts').slice(0, 10)
        : []))
      .catch(() => setOpenerPenalties([]))
  }, [role])

  const openerCount = today.opener && !today.openerConfirmed ? 1 : 0
  const closerCount = missingClosingReportsCount

  function goManage() {
    onClose()
    onOpenManage()
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <p className="font-bold text-gray-900 text-base capitalize">{role}</p>
        <button onClick={onClose}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
          Close
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
        {role === 'joe' && (
          <>
            {/* Loss Feed period totals — same table treatment as the flags below */}
            {lossSummary && (
              <LossSummaryTable summary={lossSummary} onFixNow={() => { onClose(); onGoToViolation('__loss_feed') }} />
            )}
            {/* Joe fixes violations inline here -- each row drops down to its
                own fix view (reused from whichever tab normally renders it)
                instead of navigating away, so the panel stays open. */}
            <RoleFlagsTable violations={cashViolations} assignments={assignments} deadlines={deadlines}
              assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              items={items} onItemsChanged={onItemsChanged} />
          </>
        )}
        {role === 'bino' && (
          <RoleFlagsTable violations={manageViolations} assignments={assignments} deadlines={deadlines}
            assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
            onGoToViolation={key => { onClose(); onGoToViolation(key) }} />
        )}
        {role === 'opener' && (
          <>
            {/* The morning stock count is the opener's own job -- its row
                (and click-through to the real count screen) lives here now
                instead of on Joe's panel. */}
            <RoleFlagsTable violations={openerViolations} assignments={assignments} deadlines={deadlines}
              assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
              onGoToViolation={key => { onClose(); onGoToViolation(key) }} />
            {openerCount === 0 && (
              <p className="text-sm text-gray-400 py-4">
                {today.opener
                  ? <>✓ <span className="capitalize">{today.opener}</span> has confirmed today&apos;s opening count.</>
                  : 'Nobody has clocked in yet today.'}
              </p>
            )}
            {/* Penalty Points -- real disciplinary records for past days an
                opener didn't finish the required daily counts, e.g. "James
                did not perform any count at all" or "counted only 2/15
                counts". Only shown when there's something to flag. */}
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
          </>
        )}
        {role === 'closer' && (
          closerCount > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                🌙 The closing report was missed on {closerCount} past day{closerCount !== 1 ? 's' : ''}.
              </p>
              <button onClick={goManage}
                className="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition">
                Go to Staff →
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-4">✓ Every day has a closing report.</p>
          )
        )}
      </div>
    </div>
  )
}
