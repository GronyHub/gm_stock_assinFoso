import sql from '@/lib/db'
import { once } from '@/lib/once'
import { addPoint, ensurePenalties } from '@/lib/penalties'

// A clock-in time written 30 or more minutes before the moment it was recorded is a violation (the person put in an earlier time than the real one).
// Each is recorded (no points); every FIFTH one costs 1 penalty point.
export const BACKDATE_MINUTES = 30
export const BACKDATES_PER_POINT = 5

export const ensureBackdates = once(async () => {
  await ensurePenalties()
  await sql`CREATE TABLE IF NOT EXISTS clock_backdates (id SERIAL PRIMARY KEY, staff TEXT NOT NULL, work_date TEXT NOT NULL, written TEXT NOT NULL, gap_minutes INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (staff, work_date))`.catch(() => {})
})

export async function recordBackdate(staff: string, day: string, written: string, gapMinutes: number): Promise<{ count: number; pointAwarded: boolean } | null> {
  await ensureBackdates()
  const ins = await sql`INSERT INTO clock_backdates (staff, work_date, written, gap_minutes) VALUES (${staff}, ${day}, ${written}, ${gapMinutes}) ON CONFLICT (staff, work_date) DO UPDATE SET written = EXCLUDED.written, gap_minutes = EXCLUDED.gap_minutes RETURNING id, (xmax = 0) AS fresh`
  if (!ins.length || !ins[0].fresh) return null   // the same day is only counted once
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM clock_backdates WHERE staff = ${staff}`
  const count = Number(n), kth = ((count - 1) % BACKDATES_PER_POINT) + 1
  await addPoint({ staff, points: 0, reason: `Clock-in time written ${gapMinutes} minutes before it was recorded on ${day} (${written}). Violation ${kth} of ${BACKDATES_PER_POINT}: every ${BACKDATES_PER_POINT} cost 1 point.`, source: 'backdate', ref: `backdate:${ins[0].id}`, day, by: 'system' })
  let pointAwarded = false
  if (count % BACKDATES_PER_POINT === 0) {
    await addPoint({ staff, points: 1, reason: `${BACKDATES_PER_POINT} clock-in times written 30 minutes or more before they were recorded`, source: 'backdate-point', ref: `backdate-point:${staff}:${count / BACKDATES_PER_POINT}`, day, by: 'system' })
    pointAwarded = true
  }
  return { count, pointAwarded }
}
