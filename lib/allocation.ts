import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'
import { onShift, type ClockState } from '@/lib/clockState'

// A task "anyone can do" still has one named person: chosen from the rota, among the staff scheduled at the moment it falls due.
export type Shift = { n: string; from: number; to: number }
export async function rotaShifts(day: string): Promise<Shift[]> {
  try {
    const rows = await sql`SELECT LOWER(staff_name) AS n, sched_in, sched_out FROM staff_rota
      WHERE rota_date = ${day}::date AND NOT COALESCE(is_off, false) AND staff_name <> '__shop_open__'` as unknown as { n: string; sched_in: string | null; sched_out: string | null }[]
    const abs = await sql`SELECT LOWER(staff_name) AS n FROM staff_absences WHERE COALESCE(absence_type, '') <> 'late' AND start_date <= ${day}::date AND end_date >= ${day}::date`.catch(() => []) as unknown as { n: string }[]
    const away = new Set(abs.map(a => a.n))
    return rows.filter(r => !away.has(r.n) && r.n !== 'grony').flatMap(r => { const a = parseTimeMins(r.sched_in), b = parseTimeMins(r.sched_out); return a != null && b != null ? [{ n: r.n, from: a, to: b }] : [] })
  } catch { return [] }
}

// The person a shared task falls on: rota staff scheduled at its due time AND actually at work then; failing that, whoever was clocked in then. Spread across them by task id so the same set of tasks always lands on the same people.
export function allocatedTo(tileId: number, dueMin: number, clock: ClockState, shifts: Shift[]): string | null {
  const here = (n: string) => onShift(n, dueMin, clock)
  let pool = shifts.filter(s => s.from <= dueMin && dueMin <= s.to && here(s.n)).map(s => s.n)
  if (!pool.length) pool = Object.keys(clock.ins).filter(n => n !== 'grony' && here(n))
  pool = Array.from(new Set(pool)).sort()
  return pool.length ? pool[tileId % pool.length] : null
}
