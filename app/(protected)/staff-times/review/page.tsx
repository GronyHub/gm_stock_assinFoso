'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { fmtDate } from '@/lib/fmtDate'

type RecentRow = { id?: number; staff_name: string; work_date: string; actual_in: string | null; actual_out: string | null; entered_by: string | null }

const FLAG_HOURS = 14

function parseTimeMins(t: string | null) {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1]), min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}
function minsToHrs(mins: number) {
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}

export default function LongShiftsReviewPage() {
  const [rows, setRows] = useState<(RecentRow & { mins: number })[] | null>(null)

  useEffect(() => {
    fetch('/api/staff-times/all').then(r => r.ok ? r.json() : []).then(d => {
      const all: RecentRow[] = Array.isArray(d) ? d : []
      const flagged = all
        .map(r => {
          if (!r.actual_in || !r.actual_out) return null
          const tin = parseTimeMins(r.actual_in), tout = parseTimeMins(r.actual_out)
          if (tin == null || tout == null) return null
          const mins = tout >= tin ? tout - tin : (tout + 1440) - tin
          return mins > FLAG_HOURS * 60 ? { ...r, mins } : null
        })
        .filter((r): r is RecentRow & { mins: number } => r != null)
        .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.mins - a.mins)
      setRows(flagged)
    }).catch(() => setRows([]))
  }, [])

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/staff" className="text-sm text-blue-600 font-semibold">← Staff</Link>
      </div>
      <div>
        <h1 className="text-xl font-bold">🚩 Shifts Over {FLAG_HOURS} Hours</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every recorded clock-in/clock-out pair whose total worked time exceeds {FLAG_HOURS} hours,
          for review — usually a missed clock-out rather than an actual shift that long.
        </p>
      </div>

      {rows === null ? (
        <p className="text-center text-gray-400 py-10">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Nothing over {FLAG_HOURS} hours — nothing to review.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Date</th>
                <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Staff</th>
                <th className="text-center px-2 py-2 text-xs text-green-600 font-semibold">In</th>
                <th className="text-center px-2 py-2 text-xs text-orange-500 font-semibold">Out</th>
                <th className="text-right px-3 py-2 text-xs text-red-600 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.id ?? i} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.work_date)}</td>
                  <td className="px-3 py-2.5 font-medium capitalize text-gray-900">{r.staff_name}</td>
                  <td className="px-2 py-2.5 text-center text-green-700">{r.actual_in}</td>
                  <td className="px-2 py-2.5 text-center text-orange-600">{r.actual_out}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-red-600">{minsToHrs(r.mins)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
