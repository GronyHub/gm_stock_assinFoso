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
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}
function minsToHrs(mins: number) {
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`
}
function ghanaToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' })
}

function LongShiftsTable({ rows }: { rows: (RecentRow & { mins: number })[] }) {
  if (rows.length === 0) return <p className="text-center text-gray-400 py-6">Nothing over {FLAG_HOURS} hours.</p>
  return (
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
  )
}

function IncompleteTable({ rows }: { rows: RecentRow[] }) {
  if (rows.length === 0) return <p className="text-center text-gray-400 py-6">Nothing missing an In or Out.</p>
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Date</th>
            <th className="text-left px-3 py-2 text-xs text-gray-500 font-semibold">Staff</th>
            <th className="text-center px-2 py-2 text-xs text-green-600 font-semibold">In</th>
            <th className="text-center px-2 py-2 text-xs text-orange-500 font-semibold">Out</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={r.id ?? i} className="hover:bg-gray-50">
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{fmtDate(r.work_date)}</td>
              <td className="px-3 py-2.5 font-medium capitalize text-gray-900">{r.staff_name}</td>
              <td className="px-2 py-2.5 text-center text-green-700">{r.actual_in ?? <span className="text-gray-300">—</span>}</td>
              <td className="px-2 py-2.5 text-center text-orange-600">{r.actual_out ?? <span className="text-gray-300">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function FlaggedTimesReviewPage() {
  const [longShifts, setLongShifts] = useState<(RecentRow & { mins: number })[] | null>(null)
  const [incomplete, setIncomplete] = useState<RecentRow[] | null>(null)

  useEffect(() => {
    fetch('/api/staff-times/all').then(r => r.ok ? r.json() : []).then(d => {
      const all: RecentRow[] = Array.isArray(d) ? d : []
      const today = ghanaToday()

      const long = all
        .map(r => {
          if (!r.actual_in || !r.actual_out) return null
          const tin = parseTimeMins(r.actual_in), tout = parseTimeMins(r.actual_out)
          if (tin == null || tout == null) return null
          const mins = tout >= tin ? tout - tin : (tout + 1440) - tin
          return mins > FLAG_HOURS * 60 ? { ...r, mins } : null
        })
        .filter((r): r is RecentRow & { mins: number } => r != null)
        .sort((a, b) => b.work_date.localeCompare(a.work_date) || b.mins - a.mins)
      setLongShifts(long)

      // A missing In today just means that person hasn't clocked in yet --
      // not an error worth flagging. A missing In on a past date, or a
      // missing Out on any date (including today, since staying "still
      // clocked in" past midnight is exactly the kind of forgotten
      // clock-out this page exists to surface), is worth reviewing.
      const inc = all
        .filter(r => (!!r.actual_in) !== (!!r.actual_out))
        .filter(r => !(r.actual_out && !r.actual_in && r.work_date === today))
        .sort((a, b) => b.work_date.localeCompare(a.work_date))
      setIncomplete(inc)
    }).catch(() => { setLongShifts([]); setIncomplete([]) })
  }, [])

  const loading = longShifts === null || incomplete === null

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/staff" className="text-sm text-blue-600 font-semibold">← Staff</Link>
      </div>
      <div>
        <h1 className="text-xl font-bold">🚩 Flagged Times</h1>
        <p className="text-sm text-gray-500 mt-1">Clock records worth a second look, for review.</p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Loading…</p>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Incomplete — Missing In or Out {incomplete.length > 0 && <span className="text-gray-400 font-normal">({incomplete.length})</span>}
            </h2>
            <IncompleteTable rows={incomplete} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Over {FLAG_HOURS} Hours {longShifts.length > 0 && <span className="text-gray-400 font-normal">({longShifts.length})</span>}
            </h2>
            <LongShiftsTable rows={longShifts} />
          </div>
        </>
      )}
    </div>
  )
}
