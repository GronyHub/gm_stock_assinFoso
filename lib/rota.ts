import sql from '@/lib/db'
import { parseTimeMins } from '@/lib/staffTimes'

// Who the rota names as the Opener and the Closer on each day (so the tasks of those roles have real names, also for days ahead).
// The rota's own "opener" and "closer" roles come first; a day without them falls back to the earliest start and the latest finish.
export type RotaRoles = { opener: string | null; closer: string | null; working: string[] }

export async function rotaRolesBetween(from: string, to: string): Promise<Record<string, RotaRoles>> {
  try {
    const rows = await sql`SELECT LOWER(staff_name) AS n, rota_date::text AS d, sched_in, sched_out, role FROM staff_rota
      WHERE rota_date BETWEEN ${from}::date AND ${to}::date AND NOT COALESCE(is_off, false) AND staff_name <> '__shop_open__'` as unknown as { n: string; d: string; sched_in: string | null; sched_out: string | null; role: string | null }[]
    // Someone who has reported an absence for the day is not the Opener or the Closer.
    const abs = await sql`SELECT LOWER(staff_name) AS n, start_date::text AS s, end_date::text AS e FROM staff_absences WHERE end_date >= ${from}::date AND start_date <= ${to}::date`.catch(() => []) as unknown as { n: string; s: string; e: string }[]
    const away = (n: string, d: string) => abs.some(a => a.n === n && a.s <= d && a.e >= d)
    const byDay = new Map<string, typeof rows>()
    for (const r of rows) { if (away(r.n, r.d)) continue; if (!byDay.has(r.d)) byDay.set(r.d, []); byDay.get(r.d)!.push(r) }
    const out: Record<string, RotaRoles> = {}
    for (const [d, list] of byDay) {
      const earliest = [...list].filter(r => parseTimeMins(r.sched_in) != null).sort((a, b) => parseTimeMins(a.sched_in)! - parseTimeMins(b.sched_in)!)[0]
      const latest = [...list].filter(r => parseTimeMins(r.sched_out) != null).sort((a, b) => parseTimeMins(b.sched_out)! - parseTimeMins(a.sched_out)!)[0]
      out[d] = {
        opener: list.find(r => r.role === 'opener')?.n ?? earliest?.n ?? null,
        closer: list.find(r => r.role === 'closer')?.n ?? latest?.n ?? null,
        working: list.map(r => r.n),
      }
    }
    return out
  } catch { return {} }
}
export async function rotaRolesFor(day: string): Promise<RotaRoles | null> { return (await rotaRolesBetween(day, day))[day] ?? null }

// Sunday is a shop day only when the rota has someone working it (other days always are). Reminders, tasks and day-end points follow this.
export async function isShopDay(day: string): Promise<boolean> {
  if (new Date(day + 'T00:00:00Z').getUTCDay() !== 0) return true
  return ((await rotaRolesFor(day))?.working.length ?? 0) > 0
}
