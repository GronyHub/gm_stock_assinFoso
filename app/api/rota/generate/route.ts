import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// ── Staff config ────────────────────────────────────────────────────────────
const FULL_TIME = ['Joe', 'James', 'Rawlings']
const ALL_STAFF = ['Joe', 'James', 'Rawlings', 'Bino']
const MONTHLY_TARGET = 210  // hours, full-time
const LEAVE_TARGET   = 170  // hours on a leave month
const BINO_TARGET    = 100

// Shift definitions (full-time)
type Shift = { in: string; out: string; hours: number }
const SHIFTS: Record<string, Shift> = {
  opener:  { in: '8:00am',   out: '5:00pm',  hours: 9 },
  mid:     { in: '10:00am',  out: '7:00pm',  hours: 9 },
  closer:  { in: '11:30am',  out: '8:00pm',  hours: 8.5 },
  full:    { in: '8:00am',   out: '8:00pm',  hours: 12 },
}

// Bino fixed shifts
const BINO_WKDAY = { in: '3:45pm', out: '6:45pm', hours: 3 }
const BINO_SAT   = { in: '10:00am', out: '6:30pm', hours: 8.5 }

// Off-day rotation: week index (0-3) → preferred off day (1=Mon…6=Sat)
// Joe and James never share same off day; Rawlings avoids Monday (shop needs closer from start)
const OFF_ROTATION: Record<string, number[]> = {
  Joe:      [2, 3, 4, 6],  // Tue, Wed, Thu, Sat
  James:    [4, 6, 2, 3],  // Thu, Sat, Tue, Wed
  Rawlings: [6, 4, 3, 2],  // Sat, Thu, Wed, Tue
}

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate()
}

function weekIndex(date: Date): number {
  // ISO week of month (0-based), capped at 3
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  const weekOfYear = (d: Date) => Math.floor((d.getTime() - firstDay.getTime()) / (7 * 86400000))
  return Math.min(weekIndex2(date), 3)
}

function weekIndex2(date: Date): number {
  return Math.floor((date.getDate() - 1) / 7)
}

type RotaEntry = {
  staff_name: string
  rota_date: string
  sched_in: string | null
  sched_out: string | null
  is_off: boolean
  role: string | null
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { year, month, leaveStaff } = await req.json()
  // leaveStaff: array of staff names who are on paid leave this month (170h target)

  // Load absences for this month
  const firstDay = isoDate(year, month, 1)
  const lastDay  = isoDate(year, month, daysInMonth(year, month))
  const absences = await sql`
    SELECT staff_name, start_date::text AS start_date, end_date::text AS end_date
    FROM staff_absences
    WHERE start_date <= ${lastDay} AND end_date >= ${firstDay}
  `

  function isAbsent(staff: string, dateStr: string): boolean {
    return absences.some(a =>
      a.staff_name === staff && a.start_date <= dateStr && a.end_date >= dateStr
    )
  }

  // Build weekly off-day map: staffName → Set of dates that are off
  // Strategy: each week, assign off day from rotation, but skip if staff is already absent
  const offDays: Record<string, Set<string>> = {}
  for (const s of FULL_TIME) offDays[s] = new Set()

  const totalDays = daysInMonth(year, month)
  // Group working days by week
  const weekDays: Record<number, Date[]> = {}
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    if (dow === 0) continue // Sunday always off
    const wi = weekIndex2(date)
    if (!weekDays[wi]) weekDays[wi] = []
    weekDays[wi].push(date)
  }

  for (const [wiStr, days] of Object.entries(weekDays)) {
    const wi = Number(wiStr)
    for (const staff of FULL_TIME) {
      const preferredDow = OFF_ROTATION[staff][wi % 4]
      // Find the preferred day in this week that staff is NOT already absent
      const candidate = days.find(d => d.getDay() === preferredDow && !isAbsent(staff, isoDate(d.getFullYear(), d.getMonth()+1, d.getDate())))
      if (candidate) {
        offDays[staff].add(isoDate(candidate.getFullYear(), candidate.getMonth()+1, candidate.getDate()))
      } else {
        // Fall back: first available day in this week that isn't their off day yet
        const fallback = days.find(d => {
          const ds = isoDate(d.getFullYear(), d.getMonth()+1, d.getDate())
          return !isAbsent(staff, ds) && !offDays[staff].has(ds)
        })
        if (fallback) {
          offDays[staff].add(isoDate(fallback.getFullYear(), fallback.getMonth()+1, fallback.getDate()))
        }
      }
    }
  }

  // Generate all entries
  const entries: RotaEntry[] = []

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month - 1, d)
    const dow  = date.getDay()
    const dateStr = isoDate(year, month, d)
    const isSunday = dow === 0
    const isSat    = dow === 6

    for (const staff of ALL_STAFF) {
      // Sunday: all off
      if (isSunday) {
        entries.push({ staff_name: staff, rota_date: dateStr, sched_in: null, sched_out: null, is_off: true, role: null })
        continue
      }

      // Bino
      if (staff === 'Bino') {
        if (isAbsent('Bino', dateStr)) {
          entries.push({ staff_name: 'Bino', rota_date: dateStr, sched_in: null, sched_out: null, is_off: true, role: null })
        } else if (isSat) {
          entries.push({ staff_name: 'Bino', rota_date: dateStr, sched_in: BINO_SAT.in, sched_out: BINO_SAT.out, is_off: false, role: 'normal' })
        } else {
          entries.push({ staff_name: 'Bino', rota_date: dateStr, sched_in: BINO_WKDAY.in, sched_out: BINO_WKDAY.out, is_off: false, role: 'normal' })
        }
        continue
      }

      // Full-time staff
      const absent = isAbsent(staff, dateStr)
      const dayOff = offDays[staff]?.has(dateStr) ?? false

      if (absent || dayOff) {
        entries.push({ staff_name: staff, rota_date: dateStr, sched_in: null, sched_out: null, is_off: true, role: null })
        continue
      }

      // Working day — determine available full-time on this day
      const workingFT = FULL_TIME.filter(s => !isAbsent(s, dateStr) && !(offDays[s]?.has(dateStr)))

      // Assign role/shift
      let shift: Shift = SHIFTS.mid
      let role = 'normal'

      // Opener: Joe first, else James
      const openerStaff = workingFT.find(s => s === 'Joe') ?? workingFT.find(s => s === 'James')
      // Closer: Rawlings first, else James (if not opener)
      const closerStaff = workingFT.find(s => s === 'Rawlings') ??
                          workingFT.find(s => s !== openerStaff && s === 'James')

      if (staff === openerStaff) {
        // If only 1-2 working full-time, opener covers a longer shift
        shift = workingFT.length <= 2 ? SHIFTS.full : SHIFTS.opener
        role = 'opener'
      } else if (staff === closerStaff) {
        shift = SHIFTS.closer
        role = 'closer'
      } else {
        shift = SHIFTS.mid
        role = 'normal'
      }

      entries.push({ staff_name: staff, rota_date: dateStr, sched_in: shift.in, sched_out: shift.out, is_off: false, role })
    }
  }

  // Upsert all entries
  for (const e of entries) {
    await sql`
      INSERT INTO staff_rota (staff_name, rota_date, sched_in, sched_out, is_off, role)
      VALUES (${e.staff_name}, ${e.rota_date}, ${e.sched_in}, ${e.sched_out}, ${e.is_off}, ${e.role})
      ON CONFLICT (staff_name, rota_date) DO UPDATE
        SET sched_in=${e.sched_in}, sched_out=${e.sched_out}, is_off=${e.is_off}, role=${e.role}
    `
  }

  return success({ ok: true, count: entries.length })
}
