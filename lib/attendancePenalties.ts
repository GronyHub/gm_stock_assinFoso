import sql from '@/lib/db'
import { getClockState } from '@/lib/clockState'
import { rotaShifts } from '@/lib/allocation'
import { addPoint, ensurePenalties } from '@/lib/penalties'
import { ACTIVE_STAFF } from '@/lib/staffList'

// The owner's rule: a staff member who is late or absent and has NOT told the shop in the app first costs 1 point (late) or 2 points (absent without notice).
// "Told the shop" = a report in staff_absences (type 'late' with the time they expect, or an absence) made before the late arrival / before the shift began.
export const LATE_GRACE_MIN = 10
export const LATE_POINTS = 1
export const ABSENT_POINTS = 2

export async function ensureAbsenceColumns() {
  await sql`ALTER TABLE staff_absences ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(), ADD COLUMN IF NOT EXISTS expected_time TEXT`.catch(() => {})
}

const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Charges the people on the rota for `day`. Safe to run again: each charge is unique per person and day.
export async function assessAttendance(day: string) {
  await ensurePenalties(); await ensureAbsenceColumns()
  const [clock, shifts] = [await getClockState(day), await rotaShifts(day)]
  // rotaShifts leaves out people on a reported absence; read those (and late reports) directly.
  const rows = await sql`SELECT LOWER(staff_name) AS n, absence_type AS t, created_at, start_date::text AS s, end_date::text AS e FROM staff_absences
    WHERE start_date <= ${day}::date AND end_date >= ${day}::date` as unknown as { n: string; t: string | null; created_at: string; s: string; e: string }[]
  const done: string[] = []
  for (const s of shifts) {
    if (!ACTIVE_STAFF.includes(s.n) || s.n === 'grony') continue
    const arrived = clock.ins[s.n]
    const lateRep = rows.find(r => r.n === s.n && r.t === 'late')
    if (arrived == null) {
      // Never clocked in on a rostered day, and no report of it: absent without notice. (A reported absence already took them off `shifts`.)
      await addPoint({ staff: s.n, points: ABSENT_POINTS, reason: `Absent without notice on ${day} (rostered from ${hm(s.from)}, did not clock in or report it)`, source: 'attendance', ref: `absent:${day}`, day })
      done.push(`${s.n}: absent`); continue
    }
    if (arrived > s.from + LATE_GRACE_MIN) {
      const told = lateRep && new Date(lateRep.created_at).getTime() <= new Date(`${day}T00:00:00Z`).getTime() + arrived * 60000
      if (!told) { await addPoint({ staff: s.n, points: LATE_POINTS, reason: `Late without telling the shop on ${day} (rostered ${hm(s.from)}, clocked in ${hm(arrived)})`, source: 'attendance', ref: `late:${day}`, day }); done.push(`${s.n}: late`) }
    }
  }
  return done
}
