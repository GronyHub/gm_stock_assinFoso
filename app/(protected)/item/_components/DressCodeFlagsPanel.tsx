'use client'
import { useEffect, useState } from 'react'

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
      <div className="flex items-center gap-1.5">
        {flagButtons.map(({ id, letter, label, count }) => (
          <button key={id} title={label}
            onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 flex items-center gap-0.5 text-[9px] font-semibold pl-1 pr-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 transition">
            <span className="relative leading-none">
              {count > 0 ? '🚩' : '🏳️'}
              <span className={`absolute -bottom-1 -right-1 text-[6px] font-black leading-none rounded-sm px-[1px]
                ${count > 0 ? 'bg-white text-red-700' : 'bg-red-700 text-white'}`}>{letter}</span>
            </span>
            <span className="ml-0.5">{count > 0 ? count : ''}</span>
          </button>
        ))}
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
