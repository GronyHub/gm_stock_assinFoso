'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function oldestDays(rows: any[], field: string): number | null {
  if (!rows.length) return null
  return Math.max(...rows.map(r => daysSince(r[field])))
}

export const SHORT_LABEL: Record<string, string> = {
  missing_days: 'Sales Receipts',
  no_cash: 'Cash Counts',
  cost_gte_sell: 'Cost Prices',
  no_staff_times: 'Staff Times',
  unchecked_cab: 'Cash at Bank',
  no_group: 'Item Groups',
  duplicates: 'Duplicate Items',
  not_in_inventory: 'Alias Confirmations',
  dup_receipts: 'Duplicate Receipts',
  daily: 'Daily Counts',
  '7day': '7-Day Counts',
  '15day': '15-Day Counts',
  neg_soh: 'Negative Stock Items',
  no_sp: 'Missing Selling Prices',
  no_cp: 'Missing Cost Prices',
  unlinked_named: 'Unlinked Sales',
  service_violation: 'Service Violations',
  gains: 'Gains (record errors)',
}

// All tasks default to Joe until someone explicitly assigns them elsewhere.
export const DEFAULT_ASSIGNEE = 'Joe'

// Every error type the app tracks -- active ones become task rows, clear
// ones are named in the ✓ line so nothing is silently missing. Split in two:
// CASH holds everything that touches money directly; MANAGE holds the
// operational/housekeeping tasks (staff times, count duties, item hygiene).
// Move a type between sections by moving its key in this set.
const MANAGE_TYPES = new Set([
  'no_staff_times',
])

const ALL_ERROR_TYPES = [
  'neg_soh', 'no_sp', 'no_cp', 'no_group', 'duplicates', 'not_in_inventory',
  'unlinked_named', 'service_violation', 'gains', 'daily', '7day', '15day',
  'no_cash', 'missing_days', 'cost_gte_sell', 'dup_receipts',
  'unchecked_cab', 'no_staff_times',
]

// This widget's violation "type" strings are the historical keys used by the
// staff-assignment/penalty system (violation_assignments etc.) and must stay
// as-is; they don't all match the Errors tab's own violation keys, so map
// between them here rather than renaming either side.
export const ERRORS_TAB_VIOLATION: Record<string, string> = {
  missing_days: 'missing_days',
  no_cash: 'no_cash',
  cost_gte_sell: 'cost_price',
  no_staff_times: 'no_staff_times',
  unchecked_cab: 'unchecked_cab',
  no_group: 'no_group',
  duplicates: 'duplicates',
  not_in_inventory: 'aliases',
  dup_receipts: 'dup_receipt',
}

export type Violation = { type: string; label: string; count: number; days: number | null }

// Shared by the Grony Cash panel (Item hub) and Grony Manage panel (Home) --
// both are just filtered views of the same flags/assignments data, so the
// fetching and violation-list computation lives in one place.
export function useViolations(counts?: Record<string, number>) {
  const [flags, setFlags] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [assignedBy, setAssignedBy] = useState<Record<string, string>>({})
  const [assignedOn, setAssignedOn] = useState<Record<string, string>>({})
  const [vSettings, setVSettings] = useState<Record<string, string>>({})

  function loadFlags() {
    fetch('/api/flags')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setFlags)
      .catch(() => {})
  }
  function loadAssignments() {
    fetch('/api/violations/assignments')
      .then(r => r.json())
      .then(d => {
        setAssignments(d.assignments ?? {}); setDeadlines(d.deadlines ?? {})
        setAssignedBy(d.assignedBy ?? {}); setAssignedOn(d.assignedOn ?? {})
        setVSettings(d.settings ?? {})
      })
      .catch(() => {})
  }

  useEffect(() => { loadFlags(); loadAssignments() }, [])
  usePolling(loadFlags, 30000)

  const violations = useMemo<Violation[]>(() => {
    if (!flags) return []
    const list: Violation[] = []
    if (flags.missingDays?.length) list.push({
      type: 'missing_days',
      label: 'Sales Receipt' + (flags.missingDays.length !== 1 ? 's' : '') + ' still not entered',
      count: flags.missingDays.length, days: oldestDays(flags.missingDays, 'missing_date'),
    })
    if (flags.noCash?.length) list.push({
      type: 'no_cash',
      label: 'walk-in receipt' + (flags.noCash.length !== 1 ? 's' : '') + ' missing cash counted',
      count: flags.noCash.length, days: oldestDays(flags.noCash, 'receipt_date'),
    })
    if (flags.costGteSell?.length) list.push({
      type: 'cost_gte_sell',
      label: 'Cost Price' + (flags.costGteSell.length !== 1 ? 's' : '') + ' ≥ Selling Price still unresolved',
      count: flags.costGteSell.length, days: oldestDays(flags.costGteSell, 'receipt_date'),
    })
    if (flags.noStaffTimes?.length) list.push({
      type: 'no_staff_times',
      label: 'day' + (flags.noStaffTimes.length !== 1 ? 's' : '') + ' with no staff times recorded',
      count: flags.noStaffTimes.length, days: oldestDays(flags.noStaffTimes, 'missing_date'),
    })
    if (flags.uncheckedCab?.length) list.push({
      type: 'unchecked_cab',
      label: 'week' + (flags.uncheckedCab.length !== 1 ? 's' : '') + ' with no Cash at Bank confirmation',
      count: flags.uncheckedCab.length, days: oldestDays(flags.uncheckedCab, 'week_start'),
    })
    if (flags.noGroup?.length) list.push({
      type: 'no_group',
      label: 'item' + (flags.noGroup.length !== 1 ? 's' : '') + ' with no group assigned',
      count: flags.noGroup.length, days: null,
    })
    if (flags.duplicates?.length) list.push({
      type: 'duplicates',
      label: 'possible duplicate item pair' + (flags.duplicates.length !== 1 ? 's' : ''),
      count: flags.duplicates.length, days: null,
    })
    {
      const aliasCount = counts?.['aliases'] ?? flags.notInInventory?.length ?? 0
      if (aliasCount > 0) list.push({
        type: 'not_in_inventory',
        label: 'item name' + (aliasCount !== 1 ? 's' : '') + ' awaiting alias confirmation',
        count: aliasCount, days: null,
      })
    }
    if (flags.dupReceipts?.length) list.push({
      type: 'dup_receipts',
      label: 'day' + (flags.dupReceipts.length !== 1 ? 's' : '') + ' with duplicate WIC/GMC receipts',
      count: flags.dupReceipts.length, days: oldestDays(flags.dupReceipts, 'receipt_date'),
    })
    const c = counts ?? {}
    const s = (n: number) => n !== 1 ? 's' : ''
    if (c['daily'] > 0) list.push({ type: 'daily', label: `item${s(c['daily'])} not yet counted today`, count: c['daily'], days: 0 })
    if (c['7day'] > 0) list.push({ type: '7day', label: `GMC item${s(c['7day'])} overdue for the 7-day count`, count: c['7day'], days: null })
    if (c['15day'] > 0) list.push({ type: '15day', label: `item${s(c['15day'])} overdue for the 15-day count`, count: c['15day'], days: null })
    if (c['neg_soh'] > 0) list.push({ type: 'neg_soh', label: `item${s(c['neg_soh'])} with negative stock on hand`, count: c['neg_soh'], days: null })
    if (c['no_sp'] > 0) list.push({ type: 'no_sp', label: `item${s(c['no_sp'])} with no selling price`, count: c['no_sp'], days: null })
    if (c['no_cp'] > 0) list.push({ type: 'no_cp', label: `item${s(c['no_cp'])} with no cost price`, count: c['no_cp'], days: null })
    if (c['unlinked_named'] > 0) list.push({ type: 'unlinked_named', label: `sale line${s(c['unlinked_named'])} not linked to their item`, count: c['unlinked_named'], days: null })
    if (c['service_violation'] > 0) list.push({ type: 'service_violation', label: `service${s(c['service_violation'])} with stock activity recorded`, count: c['service_violation'], days: null })
    if (c['gains'] > 0) list.push({ type: 'gains', label: `gain${s(c['gains'])} on record — every gain is a missing bill/GMC or count error`, count: c['gains'], days: null })
    const active = new Set(list.map(v => v.type))
    for (const t of ALL_ERROR_TYPES) {
      if (!active.has(t)) list.push({ type: t, label: SHORT_LABEL[t] ?? t, count: 0, days: null })
    }
    return list.sort((a, b) => b.count - a.count)
  }, [flags, counts])

  const cashViolations = violations.filter(v => !MANAGE_TYPES.has(v.type))
  const manageViolations = violations.filter(v => MANAGE_TYPES.has(v.type))
  const cashCount = cashViolations.reduce((s, v) => s + v.count, 0)
  const manageCount = manageViolations.reduce((s, v) => s + v.count, 0)

  return {
    flags, assignments, deadlines, assignedBy, assignedOn, vSettings,
    violations, cashViolations, manageViolations, cashCount, manageCount,
  }
}
