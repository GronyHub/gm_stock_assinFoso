'use client'
import { useEffect, useState } from 'react'
import { ALL_STAFF_NAMES } from '../../staff/StaffClient'

type Payslip = { staff_name: string; pay_month: string }

// Rolls forward automatically instead of a fixed month list that goes
// stale -- the current month plus the two before it, oldest first (matches
// how the old hardcoded ['2026-04', '2026-05'] list read, just self-
// updating instead of needing a code change every couple of months).
function recentMonths(count: number): string[] {
  const months: string[] = []
  const d = new Date()
  d.setDate(1)
  for (let i = 0; i < count; i++) {
    months.unshift(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    d.setMonth(d.getMonth() - 1)
  }
  return months
}
function monthLabel(m: string) {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// A reusable Manage-category tab content type (see DynamicCategoryPage.tsx)
// -- flags any staff member missing a payslip for a recent month. Used to
// live as one of All Staff's three sub-views (Disciplinary/Payslips/
// Times); moved here so it can sit inside a Manage category like "Staff
// Payments" instead, alongside Team Payslips' own actual pay records.
export default function PayslipFlagsPanel() {
  const [missing, setMissing] = useState<{ staff: string; month: string }[] | null>(null)
  const months = recentMonths(3)

  useEffect(() => {
    fetch('/api/payslips').then(r => r.ok ? r.json() : []).then(d => {
      const payslips: Payslip[] = Array.isArray(d) ? d : []
      const existing = new Set(payslips.map(p => `${p.staff_name?.toLowerCase()}|${p.pay_month?.slice(0, 7)}`))
      const result: { staff: string; month: string }[] = []
      for (const month of months) {
        for (const name of ALL_STAFF_NAMES) {
          if (!existing.has(`${name.toLowerCase()}|${month}`)) result.push({ staff: name, month })
        }
      }
      setMissing(result)
    }).catch(() => setMissing([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (missing === null) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>

  return (
    <div className="p-3 space-y-3">
      <p className="text-xs text-gray-400">Flags any staff member missing a payslip for the last {months.length} months.</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
        {months.map(month => {
          const staffMissing = missing.filter(m => m.month === month).map(m => m.staff)
          if (staffMissing.length === 0) return (
            <div key={month} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">{monthLabel(month)}</span>
              <span className="text-xs text-green-600 font-semibold">Complete ✓</span>
            </div>
          )
          return (
            <div key={month} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">{monthLabel(month)}</span>
                <span className="text-[10px] text-orange-600 font-semibold">{staffMissing.length} missing</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {staffMissing.map(s => (
                  <span key={s} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">{s}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
