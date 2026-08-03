'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'
import { NoStaffTimesList } from '../../staff/StaffClient'
import AssignWidget from '../../item/_components/AssignWidget'
import PageToolIcons from '../../item/_components/PageToolIcons'

type RecentRow = { id?: number; staff_name: string; work_date: string; actual_in: string | null; actual_out: string | null; entered_by: string | null }

const FLAG_HOURS = 14
const PM_CLOCK_IN_WATCH = new Set(['james', 'joe'])

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
function isPM(t: string | null) {
  return !!t && /pm$/i.test(t.trim())
}
function isAM(t: string | null) {
  return !!t && /am$/i.test(t.trim())
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

function TimesTable({ rows, emptyText }: { rows: RecentRow[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-center text-gray-400 py-6">{emptyText}</p>
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
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const [longShifts, setLongShifts] = useState<(RecentRow & { mins: number })[] | null>(null)
  const [incomplete, setIncomplete] = useState<RecentRow[] | null>(null)
  const [pmClockIns, setPmClockIns] = useState<RecentRow[] | null>(null)
  const [amClockOuts, setAmClockOuts] = useState<RecentRow[] | null>(null)
  const [noStaffTimes, setNoStaffTimes] = useState<string[] | null>(null)

  useEffect(() => {
    fetch('/api/flags').then(r => r.ok ? r.json() : null).then(d => {
      setNoStaffTimes((d?.noStaffTimes ?? []).map((r: { missing_date: string }) => r.missing_date))
    }).catch(() => setNoStaffTimes([]))
    fetch('/api/staff-times/all').then(r => r.ok ? r.json() : []).then(d => {
      const all: RecentRow[] = Array.isArray(d) ? d : []
      const today = ghanaToday()
      const byDateDesc = (a: RecentRow, b: RecentRow) => b.work_date.localeCompare(a.work_date)

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
        .sort(byDateDesc)
      setIncomplete(inc)

      // James and Joe are expected to open, not arrive in the afternoon --
      // a PM clock-in for either of them is almost always a mistyped time.
      setPmClockIns(all
        .filter(r => PM_CLOCK_IN_WATCH.has(r.staff_name.toLowerCase()) && isPM(r.actual_in))
        .sort(byDateDesc))

      // Clocking out in the AM only makes sense for an overnight shift --
      // for everyone else it's a mistyped time (meant PM).
      setAmClockOuts(all.filter(r => isAM(r.actual_out)).sort(byDateDesc))
    }).catch(() => { setLongShifts([]); setIncomplete([]); setPmClockIns([]); setAmClockOuts([]) })
  }, [])

  const loading = longShifts === null || incomplete === null || pmClockIns === null || amClockOuts === null || noStaffTimes === null

  return (
    <div className="py-4 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/staff" className="text-sm text-blue-600 font-semibold">← Staff</Link>
      </div>
      <div>
        <h1 className="text-xl font-bold">🚩 Flagged Times</h1>
        <p className="text-sm text-gray-500 mt-1">Clock records worth a second look, for review.</p>
      </div>

      <PageToolIcons scopeKey="Team" />
      <AssignWidget type="no_staff_times" />

      {loading ? (
        <p className="text-center text-gray-400 py-10">Loading…</p>
      ) : (
        <>
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Incomplete — Missing In or Out {incomplete.length > 0 && <span className="text-gray-400 font-normal">({incomplete.length})</span>}
            </h2>
            <TimesTable rows={incomplete} emptyText="Nothing missing an In or Out." />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              James/Joe Clocked In (PM) {pmClockIns.length > 0 && <span className="text-gray-400 font-normal">({pmClockIns.length})</span>}
            </h2>
            <TimesTable rows={pmClockIns} emptyText="No PM clock-ins for James or Joe." />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Clocked Out (AM) {amClockOuts.length > 0 && <span className="text-gray-400 font-normal">({amClockOuts.length})</span>}
            </h2>
            <TimesTable rows={amClockOuts} emptyText="No AM clock-outs." />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              Over {FLAG_HOURS} Hours {longShifts.length > 0 && <span className="text-gray-400 font-normal">({longShifts.length})</span>}
            </h2>
            <LongShiftsTable rows={longShifts} />
          </div>

          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
              No Team Times Recorded {noStaffTimes.length > 0 && <span className="text-gray-400 font-normal">({noStaffTimes.length})</span>}
            </h2>
            <p className="text-xs text-gray-400">Days that have a sales receipt but no staff time was entered.</p>
            <NoStaffTimesList dates={noStaffTimes} role={role} username={username}
              onFixed={d => setNoStaffTimes(prev => prev ? prev.filter(x => x !== d) : prev)} />
          </div>
        </>
      )}
    </div>
  )
}
