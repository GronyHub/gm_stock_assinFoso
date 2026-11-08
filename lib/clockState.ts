import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'

// Who is at work today, from the clock-in records (Ghana is on GMT, so UTC days are the shop's days).
export type ClockState = { dayStart: number | null; present: string[]; everIn: string[] }
export async function getClockState(day: string): Promise<ClockState> {
  const rows = await sql`
    SELECT LOWER(staff_name) AS name, actual_in, actual_out FROM staff_times
    WHERE work_date = ${day} AND staff_name <> '__shop_open__' AND actual_in IS NOT NULL` as unknown as { name: string; actual_in: string; actual_out: string | null }[]
  let dayStart: number | null = null
  for (const r of rows) { const m = parseTimeMins(r.actual_in); if (m != null && (dayStart == null || m < dayStart)) dayStart = m }
  return { dayStart, present: rows.filter(r => !r.actual_out).map(r => r.name), everIn: rows.map(r => r.name) }
}
export const actorKey = (u: { username?: string; name?: string | null } | undefined) => String(u?.username ?? u?.name ?? '').toLowerCase()
