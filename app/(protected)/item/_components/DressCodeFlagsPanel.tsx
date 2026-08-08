'use client'
import { useEffect, useState } from 'react'
import PageToolIcons from './PageToolIcons'

type ShirtNotWorn = { staff_name: string; work_date: string }
type ShirtOverdue = { staff_name: string; due_date: string }

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Dress code flags are self-attributed to the named staff member rather than
// a page owner/manager (see the Opener-accountability pass in
// /api/violations/auto-check) -- so unlike the other Manage flag panels this
// has no AssignWidget, just the two read-only flag lists the auto-penalty
// check acts on directly.
export default function DressCodeFlagsPanel() {
  const [notWorn, setNotWorn] = useState<ShirtNotWorn[] | null>(null)
  const [overdue, setOverdue] = useState<ShirtOverdue[] | null>(null)

  useEffect(() => {
    fetch('/api/flags').then(r => r.ok ? r.json() : {}).then((d: any) => {
      setNotWorn(Array.isArray(d.shirtNotWorn) ? d.shirtNotWorn : [])
      setOverdue(Array.isArray(d.shirtOverdue) ? d.shirtOverdue : [])
    }).catch(() => { setNotWorn([]); setOverdue([]) })
  }, [])

  if (notWorn === null || overdue === null) return <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>

  // Group "not worn" instances by staff so repeat lapses are obvious at a glance.
  const byStaff = new Map<string, string[]>()
  for (const r of notWorn) {
    if (!byStaff.has(r.staff_name)) byStaff.set(r.staff_name, [])
    byStaff.get(r.staff_name)!.push(r.work_date)
  }

  // Same 🚩/🏳️ + letter + count treatment as Sales/Items/Counts' flag
  // buttons -- both sections already show together on this page (no
  // separate fix view to jump to), so clicking just scrolls to it.
  const flagButtons: { id: string; letter: string; label: string; count: number }[] = [
    { id: 'dress-not-worn', letter: 'W', label: 'Dress Code (Not Worn)', count: byStaff.size },
    { id: 'dress-overdue', letter: 'O', label: 'Dress Code (T-Shirt Overdue)', count: overdue.length },
  ]

  return (
    <div className="p-3 space-y-4">
      {/* Law/Notes/Tasks + this page's own flag pills, together in one row
          -- rendered here (not in StaffPersonTab.tsx above this component)
          so they share the same row instead of PageToolIcons sitting alone
          above it. */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <PageToolIcons scopeKey="Team Dress Code"
          flags={flagButtons.map(({ id, letter, label, count }) => ({ key: id, letter, label, count }))}
          onFlagClick={id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
      </div>
      <div id="dress-not-worn" className="space-y-2">
        <p className="text-xs text-gray-400">
          Staff who own a company t-shirt but were logged by the Closer as not wearing it. Penalty points build up automatically once someone racks up repeat lapses.
        </p>
        {byStaff.size === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-green-600 font-semibold">Nothing flagged ✓</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {[...byStaff.entries()].map(([staff, dates]) => (
              <div key={staff} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">{staff}</span>
                  <span className="text-[10px] text-orange-600 font-semibold">{dates.length} day{dates.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dates.map(d => (
                    <span key={d} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{fmtDate(d)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div id="dress-overdue" className="space-y-2">
        <p className="text-xs text-gray-400">Staff who don&apos;t yet own a company t-shirt, past their given due date.</p>
        {overdue.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-green-600 font-semibold">Nothing flagged ✓</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
            {overdue.map(r => (
              <div key={r.staff_name} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-gray-700">{r.staff_name}</span>
                <span className="text-[10px] text-red-600 font-semibold">due {fmtDate(r.due_date)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
