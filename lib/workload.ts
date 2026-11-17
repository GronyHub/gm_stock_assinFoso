import sql from '@/lib/db'
import { getClockState } from '@/lib/clockState'
import { rotaShifts } from '@/lib/allocation'
import { ACTIVE_STAFF } from '@/lib/staffList'
import { addPoint } from '@/lib/penalties'
import { parseViolations } from '@/lib/lawViolations'
import { getActivityDurationOverrides } from '@/lib/activityDurations'
import { effectiveDurationSeconds } from '@/lib/workedDuration'

// The workload rule: the activities a person logs in a day (every logged activity carries an estimated number of minutes, whoever it was assigned to)
// must add up to at least half of the time they were at the shop. Someone busy can have another person do and log the work: it counts for who logged it.
export const WORKLOAD_SEED = 'workload-v1'

export type Workload = { name: string; shift: number; target: number; worked: number; short: number }

// Minutes of logged activity per person on a day (UTC date, like the rest of the day logic). An activity that carries its own length (a sale tap, a checklist task) uses it;
// every other activity uses the minutes set in Activity Times, or the default (see lib/workedDuration.ts).
export async function workedMinutes(day: string): Promise<Map<string, number>> {
  const [rows, overrides] = await Promise.all([
    sql`SELECT LOWER(author) AS n, category, estimated_duration_seconds AS s FROM announcements WHERE created_at >= ${day}::date AND created_at < ${day}::date + 1`.catch(() => []) as unknown as Promise<{ n: string; category: string | null; s: number | null }[]>,
    getActivityDurationOverrides().catch(() => ({} as Record<string, number>)),
  ])
  const secs = new Map<string, number>()
  for (const r of rows) secs.set(r.n, (secs.get(r.n) ?? 0) + effectiveDurationSeconds(r.category, r.s, overrides))
  return new Map(Array.from(secs, ([n, s]) => [n, Math.round(s / 60)]))
}

// Each person's time at the shop (clock in to clock out; a person still in is counted to `endMin`) against what they logged.
export async function workloadFor(day: string, endMin?: number): Promise<Workload[]> {
  const [clock, shifts, worked] = await Promise.all([getClockState(day).catch(() => null), rotaShifts(day), workedMinutes(day)])
  const now = new Date(), nowMin = endMin ?? now.getUTCHours() * 60 + now.getUTCMinutes(), isToday = day === now.toISOString().slice(0, 10)
  const out: Workload[] = []
  for (const n of ACTIVE_STAFF) {
    if (n === 'grony') continue
    const from = clock?.ins[n] ?? null            // only people who actually clocked in were at the shop
    if (from == null) continue
    const to = clock?.outs[n] ?? (isToday ? Math.max(from, nowMin) : shifts.find(s => s.n === n)?.to ?? from)   // an earlier day without a clock-out: the rota's end
    const shift = Math.max(0, to - from), target = Math.round(shift / 2), w = worked.get(n) ?? 0
    out.push({ name: n, shift, target, worked: w, short: Math.max(0, target - w) })
  }
  return out
}

// Day end: a person who was at the shop and logged less than half of that time costs the law's points. Only while the law is live (the owner approves it).
export async function assessWorkload(day: string) {
  const [law] = await sql`SELECT id, code, violations, points FROM page_laws WHERE seed = ${WORKLOAD_SEED} AND status = 'live' LIMIT 1`.catch(() => []) as unknown as { id: number; code: string | null; violations: string | null; points: number | null }[]
  if (!law) return
  const pts = Math.round(parseViolations(law.violations)[0]?.points ?? Number(law.points ?? 1))
  if (pts <= 0) return
  const hm = (m: number) => `${Math.floor(m / 60)} h ${m % 60} min`
  for (const p of await workloadFor(day)) {
    if (p.shift < 60 || p.worked >= p.target) continue
    await addPoint({ staff: p.name, points: pts, reason: `${law.code ?? 'Workload'}: ${hm(p.worked)} of work logged on ${day}, less than half of the ${hm(p.shift)} at the shop (${hm(p.target)} needed)`, source: 'workload', ref: `workload:${day}`, lawId: law.id, lawCode: law.code, day })
  }
}
