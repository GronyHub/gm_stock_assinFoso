'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'
import { usePolling } from '@/lib/usePolling'
import DayBookFeed from '@/components/DayBookFeed'

const fmt = (v: any) => `₵${Number(v ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 0 })}`

function Card({ title, children, href, linkLabel }: { title: string; children: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        {href && (
          <Link href={href} className="text-xs text-blue-600 font-semibold hover:underline">
            {linkLabel ?? 'View →'}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

function agePhrase(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'for 1 day now'
  return `for ${days} days now`
}

function oldestDays(rows: any[], field: string): number | null {
  if (!rows.length) return null
  return Math.max(...rows.map(r => daysSince(r[field])))
}

const AUTO_PENALIZABLE = new Set(['missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab'])

export default function TodayPage() {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [flags, setFlags] = useState<any | null>(null)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [vSettings, setVSettings] = useState<Record<string, string>>({})

  function load() {
    fetch('/api/today/summary')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }
  function loadFlags() {
    fetch('/api/flags')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setFlags)
      .catch(() => {})
  }
  function loadAssignments() {
    fetch('/api/violations/assignments')
      .then(r => r.json())
      .then(d => { setAssignments(d.assignments ?? {}); setVSettings(d.settings ?? {}) })
      .catch(() => {})
  }

  useEffect(() => { load(); loadFlags(); loadAssignments() }, [])
  usePolling(load, 10000)
  usePolling(loadFlags, 30000)

  const violations = useMemo(() => {
    if (!flags) return []
    const list: { type: string; label: string; count: number; days: number | null; href: string }[] = []
    if (flags.missingDays?.length) list.push({
      type: 'missing_days',
      label: 'Sales Receipt' + (flags.missingDays.length !== 1 ? 's' : '') + ' still not entered',
      count: flags.missingDays.length, days: oldestDays(flags.missingDays, 'missing_date'), href: '/sales?tab=Missing Days',
    })
    if (flags.noCash?.length) list.push({
      type: 'no_cash',
      label: 'walk-in receipt' + (flags.noCash.length !== 1 ? 's' : '') + ' missing cash counted',
      count: flags.noCash.length, days: oldestDays(flags.noCash, 'receipt_date'), href: '/sales?tab=No Cash',
    })
    if (flags.costGteSell?.length) list.push({
      type: 'cost_gte_sell',
      label: 'Cost Price' + (flags.costGteSell.length !== 1 ? 's' : '') + ' ≥ Selling Price still unresolved',
      count: flags.costGteSell.length, days: oldestDays(flags.costGteSell, 'receipt_date'), href: '/sales?tab=Cost Price',
    })
    if (flags.noStaffTimes?.length) list.push({
      type: 'no_staff_times',
      label: 'day' + (flags.noStaffTimes.length !== 1 ? 's' : '') + ' with no staff times recorded',
      count: flags.noStaffTimes.length, days: oldestDays(flags.noStaffTimes, 'missing_date'), href: '/staff?tab=No Times',
    })
    if (flags.uncheckedCab?.length) list.push({
      type: 'unchecked_cab',
      label: 'week' + (flags.uncheckedCab.length !== 1 ? 's' : '') + ' with no Cash at Bank confirmation',
      count: flags.uncheckedCab.length, days: oldestDays(flags.uncheckedCab, 'week_start'), href: '/cash-at-bank?tab=CAB Weekly',
    })
    if (flags.noGroup?.length) list.push({
      type: 'no_group',
      label: 'item' + (flags.noGroup.length !== 1 ? 's' : '') + ' with no group assigned',
      count: flags.noGroup.length, days: null, href: '/item?tab=No Group',
    })
    if (flags.duplicates?.length) list.push({
      type: 'duplicates',
      label: 'possible duplicate item pair' + (flags.duplicates.length !== 1 ? 's' : ''),
      count: flags.duplicates.length, days: null, href: '/item?tab=Duplicates',
    })
    if (flags.notInInventory?.length) list.push({
      type: 'not_in_inventory',
      label: 'item name' + (flags.notInInventory.length !== 1 ? 's' : '') + ' not found in inventory',
      count: flags.notInInventory.length, days: null, href: '/item?tab=Not in Inv.',
    })
    return list.sort((a, b) => b.count - a.count)
  }, [flags])

  const totalViolations = violations.reduce((s, v) => s + v.count, 0)

  if (loading) return <div className="py-10 text-center text-gray-400">Loading…</div>
  if (!data) return <div className="py-10 text-center text-gray-400">Could not load today's summary.</div>

  const sales = data.sales ?? {}
  const bills = data.bills ?? {}
  const expenses = data.expenses ?? {}

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Today</h1>
        <p className="text-sm text-gray-400">{fmtDate(data.date)}</p>
      </div>

      <Card title="Sales" href="/sales">
        <div className="flex gap-2">
          <div className="flex-1 bg-blue-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400">Total</p>
            <p className="text-base font-bold text-blue-700">{fmt(sales.total)}</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400">WIC</p>
            <p className="text-sm font-semibold text-gray-700">{fmt(sales.wic)}</p>
          </div>
          <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] text-gray-400">GMC</p>
            <p className="text-sm font-semibold text-gray-700">{fmt(sales.gmc)}</p>
          </div>
        </div>
        <p className="text-xs text-gray-400">{sales.count ?? 0} receipt{Number(sales.count) !== 1 ? 's' : ''} today</p>
        <Link href="/sales/new" className="inline-block text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-500">
          + New Sale
        </Link>
      </Card>

      <Card title="Bills" href="/bills">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-orange-600">{fmt(bills.total)}</p>
          <p className="text-xs text-gray-400">{bills.count ?? 0} bill{Number(bills.count) !== 1 ? 's' : ''} today</p>
        </div>
      </Card>

      <Card title="Expenses" href="/expenses">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-red-500">{fmt(expenses.total)}</p>
          <p className="text-xs text-gray-400">{expenses.count ?? 0} entr{Number(expenses.count) === 1 ? 'y' : 'ies'} today</p>
        </div>
      </Card>

      <Card title="Stock Counting" href="/stock/counts?tab=Daily" linkLabel="Count Now →">
        {data.pendingDailyCount > 0 ? (
          <p className="text-sm text-gray-700">
            <span className="font-bold text-orange-600">{data.pendingDailyCount}</span> daily item{data.pendingDailyCount !== 1 ? 's' : ''} still need counting today
          </p>
        ) : (
          <p className="text-sm text-green-600 font-medium">All daily items counted ✓</p>
        )}
      </Card>

      <Card title="Staff Today" href="/staff">
        {(!data.staffToday || data.staffToday.length === 0) ? (
          <p className="text-sm text-gray-400">No one has clocked in yet.</p>
        ) : (
          <div className="space-y-1.5">
            {data.staffToday.map((s: any) => (
              <div key={s.staff_name} className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize text-gray-700">{s.staff_name}</span>
                <span className="text-xs text-gray-500">
                  <span className="text-green-700">{s.actual_in ?? '—'}</span>
                  {' → '}
                  <span className="text-orange-600">{s.actual_out ?? '—'}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Cash at Bank" href="/cash-at-bank">
        {data.latestCab ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Last confirmed: {fmtDate(String(data.latestCab.entry_date).slice(0,10))}</span>
            <span className={`font-semibold ${Number(data.latestCab.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {data.latestCab.deficit != null ? fmt(data.latestCab.deficit) : ''}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No confirmed cash-at-bank entry yet.</p>
        )}
      </Card>

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Needs Attention {totalViolations > 0 && <span className="text-red-500">({totalViolations})</span>}
          </p>
          <Link href="/staff?tab=Assignments" className="text-xs text-blue-600 font-semibold hover:underline">
            Assign →
          </Link>
        </div>
        {!flags ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : violations.length === 0 ? (
          <p className="text-sm text-green-600 font-medium">Nothing outstanding — all clear ✓</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {violations.map(v => {
              const assignedTo = assignments[v.type]
              const canAutoPenalize = AUTO_PENALIZABLE.has(v.type)
              const threshold = parseInt(vSettings.threshold_days ?? '3', 10)
              const atRisk = canAutoPenalize && assignedTo && v.days != null && v.days >= threshold
              return (
                <Link key={v.href} href={v.href}
                  className="flex items-center justify-between py-2 hover:bg-gray-50 -mx-1 px-1 rounded transition gap-2">
                  <div className="min-w-0">
                    <span className="text-sm text-gray-700">
                      <span className="font-bold text-red-500">{v.count}</span> {v.label}
                      {v.days != null && <span className="text-gray-400"> — {agePhrase(v.days)}</span>}
                    </span>
                    <div className="text-[11px] mt-0.5">
                      {assignedTo ? (
                        <span className={atRisk ? 'text-red-500 font-semibold' : 'text-gray-400'}>
                          Assigned: <span className="capitalize">{assignedTo}</span>
                          {atRisk && ' — penalty pending'}
                        </span>
                      ) : (
                        <span className="text-gray-300">Unassigned</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-blue-600 font-semibold shrink-0">Fix →</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-gray-200">
        <DayBookFeed />
      </div>
    </div>
  )
}
