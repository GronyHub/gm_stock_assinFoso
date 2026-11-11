import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'

// Who is at work today, from the clock-in records (Ghana is on GMT, so UTC days are the shop's days).
export type ClockState = { dayStart: number | null; present: string[]; everIn: string[]; opener: string | null; lastOut: string | null }
export async function getClockState(day: string): Promise<ClockState> {
  const rows = await sql`
    SELECT LOWER(staff_name) AS name, actual_in, actual_out FROM staff_times
    WHERE work_date = ${day} AND staff_name <> '__shop_open__' AND actual_in IS NOT NULL` as unknown as { name: string; actual_in: string; actual_out: string | null }[]
  let dayStart: number | null = null
  for (const r of rows) { const m = parseTimeMins(r.actual_in); if (m != null && (dayStart == null || m < dayStart)) dayStart = m }
  // The Opener is the first to clock in; the Closer is the last to clock out (null until someone has clocked out).
  let opener: string | null = null, openMin = Infinity, lastOut: string | null = null, outMin = -1
  for (const r of rows) {
    const i = parseTimeMins(r.actual_in); if (i != null && i < openMin) { openMin = i; opener = r.name }
    const o = r.actual_out ? parseTimeMins(r.actual_out) : null; if (o != null && o >= outMin) { outMin = o; lastOut = r.name }
  }
  return { dayStart, present: rows.filter(r => !r.actual_out).map(r => r.name), everIn: rows.map(r => r.name), opener, lastOut }
}
export const actorKey = (u: { username?: string; name?: string | null } | undefined) => String(u?.username ?? u?.name ?? '').toLowerCase()
