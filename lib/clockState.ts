import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'
import { rotaRolesFor } from '@/lib/rota'

// Who is at work today, from the clock-in records (Ghana is on GMT, so UTC days are the shop's days).
export type ClockState = { dayStart: number | null; present: string[]; everIn: string[]; opener: string | null; lastOut: string | null; ins: Record<string, number>; outs: Record<string, number | null> }
// A task only counts for someone who was at work when it fell due: due before they clocked in, or after they clocked out, is not theirs.
export function onShift(name: string, dueMin: number, clock: Pick<ClockState, 'ins' | 'outs'>): boolean {
  const i = clock.ins[name.toLowerCase()]; if (i == null) return false
  const o = clock.outs[name.toLowerCase()]
  return dueMin >= i && (o == null || dueMin <= o)
}
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
  // The rota names the Opener and the Closer when it can: a person who is on the rota for that role and actually clocked in carries it.
  const rr = await rotaRolesFor(day)
  const everIn = rows.map(r => r.name)
  if (rr?.opener && everIn.includes(rr.opener)) opener = rr.opener
  if (rr?.closer && everIn.includes(rr.closer)) lastOut = rr.closer
  const ins: Record<string, number> = {}, outs: Record<string, number | null> = {}
  for (const r of rows) { const i = parseTimeMins(r.actual_in); if (i != null) ins[r.name] = Math.min(ins[r.name] ?? i, i); outs[r.name] = r.actual_out ? parseTimeMins(r.actual_out) : null }
  return { dayStart, present: rows.filter(r => !r.actual_out).map(r => r.name), everIn, opener, lastOut, ins, outs }
}
export const actorKey = (u: { username?: string; name?: string | null } | undefined) => String(u?.username ?? u?.name ?? '').toLowerCase()
