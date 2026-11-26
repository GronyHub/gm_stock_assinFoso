import sql from '@/lib/db'
import { addPoint, ensurePenalties } from '@/lib/penalties'
import { parseViolations } from '@/lib/lawViolations'
import { addDays, dayKey, weekStart } from '@/lib/dailyChecksShared'
import { measureOf } from '@/lib/targetMeasures'

// WEEKLY TARGETS. A law of type "target" names something the app can count and a number: every staff member reaches it each week (Monday to Sunday).
// A week with fewer than 5 working days is scaled to the days worked (when the law says so). The first working day of the next week, each person who fell short gets
// the points on the law's first violation line. The same figures are shown on each person's Today (Waiting) as a tile with progress.
export const FULL_WEEK_DAYS = 5
export { TARGET_MEASURES, measureOf } from '@/lib/targetMeasures'

type Law = { id: number; text: string; title: string | null; target_measure: string | null; target_n: string | number | null; target_scale: boolean | null; target_from: string | null; target_ref: number | null; violations: string | null; points: number | null }

const n0 = (r: { n?: unknown }[] | undefined) => Number(r?.[0]?.n ?? 0)
// What one person did in the week starting `ws` (Monday).
export async function measured(measure: string, who: string, ws: string, ref?: number | null): Promise<number> {
  const we = addDays(ws, 6)
  try {
    switch (measure) {
      case 'counts': return n0(await sql`SELECT COUNT(DISTINCT item_id)::int AS n FROM stock_counts WHERE LOWER(counted_by) = ${who} AND count_date >= ${ws}::date AND count_date <= ${we}::date`)
      case 'sales_count': return n0(await sql`SELECT COUNT(*)::int AS n FROM live_sale_taps WHERE LOWER(staff_name) = ${who} AND NOT COALESCE(undone, false) AND tapped_at >= ${ws}::date AND tapped_at < (${we}::date + 1)`)
      case 'sales_value': return Number((await sql`SELECT COALESCE(SUM(price * COALESCE(quantity, 1)), 0)::float AS n FROM live_sale_taps WHERE LOWER(staff_name) = ${who} AND NOT COALESCE(undone, false) AND tapped_at >= ${ws}::date AND tapped_at < (${we}::date + 1)`)[0]?.n ?? 0)
      case 'tasks_done': return n0(await sql`SELECT COUNT(*)::int AS n FROM daily_check_events WHERE LOWER(recorded_by) = ${who} AND day >= ${ws} AND day <= ${we} AND value <> 'Not done' AND COALESCE(extra->>'confirm', '') <> 'rejected'`)
      case 'customers_added': return n0(await sql`SELECT COUNT(*)::int AS n FROM customers WHERE LOWER(added_by) = ${who} AND created_at >= ${ws}::date AND created_at < (${we}::date + 1)`)
      case 'bills_recorded': return n0(await sql`SELECT COUNT(*)::int AS n FROM bills WHERE LOWER(entered_by) = ${who} AND bill_date >= ${ws}::date AND bill_date <= ${we}::date`)
      case 'expenses_recorded': return n0(await sql`SELECT COUNT(*)::int AS n FROM expenses WHERE LOWER(entered_by) = ${who} AND expense_date >= ${ws}::date AND expense_date <= ${we}::date`)
      case 'flags_fixed': {
        // The daily flags figures: the days already assessed, plus today as it stands.
        const [a] = await sql`SELECT COALESCE(SUM(fixed), 0)::int AS n FROM flag_quota WHERE day >= ${ws} AND day <= ${we} AND assessed_at IS NOT NULL`
        const t = dayKey(); let live = 0
        if (t >= ws && t <= we) { const [d] = await sql`SELECT assessed_at FROM flag_quota WHERE day = ${t}`.catch(() => [undefined]); if (!d?.assessed_at) live = (await (await import('./flagQuota')).progress(t).catch(() => ({ fixed: 0 }))).fixed }
        return Number(a?.n ?? 0) + live
      }
      case 'task_done': return !ref ? 0 : n0(await sql`SELECT COUNT(*)::int AS n FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id WHERE t.law_id = ${ref} AND LOWER(e.recorded_by) = ${who} AND e.day >= ${ws} AND e.day <= ${we} AND e.value <> 'Not done' AND COALESCE(e.extra->>'confirm', '') <> 'rejected'`)
      case 'jobs_done': return n0(await sql`SELECT COUNT(*)::int AS n FROM pending_jobs WHERE status = 'done' AND LOWER(updated_by) = ${who} AND done_at >= ${ws}::date AND done_at < (${we}::date + 1)`)
    }
  } catch { /* a measure that cannot be read counts as 0 */ }
  return 0
}

async function daysWorked(who: string, ws: string): Promise<number> {
  const [r] = await sql`SELECT COUNT(DISTINCT work_date)::int AS n FROM staff_times WHERE LOWER(staff_name) = ${who} AND work_date >= ${ws} AND work_date <= ${addDays(ws, 6)} AND actual_in IS NOT NULL`.catch(() => [{ n: 0 }])
  return Number(r?.n ?? 0)
}
export const scaled = (n: number, days: number, scale: boolean) => (!scale ? n : days <= 0 ? 0 : Math.max(1, Math.round(n * Math.min(days, FULL_WEEK_DAYS) / FULL_WEEK_DAYS * 10) / 10))
const label = (l: Law) => (l.title && l.title.trim()) || l.text.split(/[.:]/)[0].trim().slice(0, 70)

export async function targetLaws(): Promise<Law[]> {
  return await sql`SELECT id, text, title, target_measure, target_n, target_scale, target_from, target_ref, violations, points FROM page_laws WHERE law_type = 'target' AND status = 'live' AND target_measure IS NOT NULL AND target_n IS NOT NULL ORDER BY id` as unknown as Law[]
}
export async function staffNames(): Promise<string[]> {
  return (await sql`SELECT LOWER(username) AS u FROM app_users WHERE active IS NOT FALSE AND role NOT IN ('owner', 'children_manager')` as unknown as { u: string }[]).map(r => r.u)
}

// Where each person stands this week on every live target (Today tiles and the login reminder). Kept for a few minutes.
const cache = new Map<string, { at: number; data: Progress[] }>()
export type Progress = { lawId: number; who: string; label: string; measure: string; unit: string; mine: number; target: number; started: boolean; from: string; href?: string }
export async function targetProgress(day = dayKey(), only?: string): Promise<Progress[]> {
  const ws = weekStart(day), key = `${ws}|${only ?? ''}`, hit = cache.get(key)
  if (hit && Date.now() - hit.at < 3 * 60 * 1000) return hit.data
  const laws = await targetLaws(), everyone = await staffNames(), out: Progress[] = []
  for (const l of laws) {
    const m = measureOf(l.target_measure); if (!m || m.key === 'ticks') continue
    const staff = (m.manager ? ['joe'] : everyone).filter(w => !only || w === only)
    for (const who of staff) {
      const from = l.target_from ?? ws
      out.push({ lawId: l.id, who, label: label(l), measure: m.key, unit: m.unit, mine: Math.round(await measured(m.key, who, ws, l.target_ref) * 10) / 10, target: Number(l.target_n), started: ws >= weekStart(from), from, href: m.href })
    }
  }
  cache.set(key, { at: Date.now(), data: out })
  return out
}

// The first working day after a week ends: every person who fell short of a live target gets that law's points (once per person, law and week).
export async function assessTargets(day: string) {
  await ensurePenalties()
  const prev = addDays(weekStart(day), -7)
  const laws = await targetLaws(), staff = await staffNames()
  for (const l of laws) {
    const m = measureOf(l.target_measure); if (!m || m.key === 'ticks') continue
    if (prev < weekStart(l.target_from ?? prev)) continue
    const pts = parseViolations(l.violations)[0]?.points ?? l.points ?? 1
    if (!(pts > 0)) continue
    for (const who of (m.manager ? ['joe'] : staff)) {
      const target = scaled(Number(l.target_n), await daysWorked(who, prev), l.target_scale !== false)
      if (target <= 0) continue
      const mine = await measured(m.key, who, prev, l.target_ref)
      if (mine >= target) continue
      await addPoint({ staff: who, points: pts, lawId: l.id, reason: `${label(l)}: ${Math.round(mine * 10) / 10} of ${Math.round(target * 10) / 10} ${m.unit} in the week of ${prev} (the weekly target is ${Number(l.target_n)}${l.target_scale !== false ? ', scaled to the days worked' : ''})`, source: 'target', ref: `target:${l.id}:${prev}`, day, by: 'system' })
    }
  }
  await assessTicks(day, prev, staff)
}

// Ticked targets: each staff member needs a tick for every item that was not sent back. A tick still waiting for confirmation counts (the supervisor, not the staff member, is late then).
async function assessTicks(day: string, prev: string, staff: string[]) {
  const { tickLaws, itemsOf, ticksOfWeek } = await import('./ticks')
  const laws = await tickLaws(), ticks = await ticksOfWeek(prev)
  for (const l of laws) {
    if (prev < weekStart(l.target_from ?? prev)) continue
    const pts = parseViolations(l.violations)[0]?.points ?? l.points ?? 1
    if (!(pts > 0)) continue
    const items = itemsOf(l)
    for (const who of staff) {
      if ((await daysWorked(who, prev)) <= 0) continue
      for (const item of items) {
        if (ticks.some(t => t.law_id === l.id && t.staff === who && t.item === item && t.status !== 'rejected')) continue
        await addPoint({ staff: who, points: pts, lawId: l.id, reason: `${item}: not ticked (or sent back by the supervisor) in the week of ${prev}`, source: 'target', ref: `tick:${l.id}:${prev}:${items.indexOf(item)}`, day, by: 'system' })
      }
    }
  }
}
