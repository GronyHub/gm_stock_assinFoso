import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import sql from '@/lib/db'
import { ensurePenalties, totalPoints, getSettings } from '@/lib/penalties'
import { dutiesForDate } from '@/lib/duties'
import { addDays, dayKey, CHECKLIST_START } from '@/lib/dailyChecksShared'

// GET ?who=james -- the read-only summary of one person for the Waiting page: penalty points, tasks done and not done (by area and in total), time at the shop,
// lateness and absence, and sales. A staff member can read only their own; the owner and Joe can read anyone's.
const DAYS = 30
const cache = new Map<string, { at: number; data: unknown }>()
const TTL = 20 * 60 * 1000
const toMin = (t: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null }

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase()
    const who = String(req.nextUrl.searchParams.get('who') ?? me).toLowerCase().trim()
    if (!who || !/^[a-z0-9_.-]{1,40}$/.test(who)) return badRequest('Whose?')
    if (who !== me && !isOwnerLevel(session.user as never)) return badRequest('You can see only your own summary.')
    const hit = cache.get(who)
    if (hit && Date.now() - hit.at < TTL) return success(hit.data)

    await ensurePenalties()
    const today = dayKey(), since = addDays(today, -DAYS)
    const st = await getSettings()
    const [points, viol, doneRows, notDoneRows, times, sales] = await Promise.all([
      totalPoints(who),
      sql`SELECT day, points, reason, status, kind FROM staff_penalties WHERE staff = ${who} AND kind = 'violation' AND status IN ('active', 'pending', 'disputed') AND day >= ${since} ORDER BY day DESC, id DESC LIMIT 30`,
      sql`SELECT COALESCE(t.category, 'Other') AS cat, COUNT(*)::int AS n FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
          WHERE LOWER(e.recorded_by) = ${who} AND e.day >= ${since} AND e.value <> 'Not done' AND COALESCE(e.extra->>'confirm', '') <> 'rejected' GROUP BY 1`,
      sql`SELECT COALESCE(t.category, 'Other') AS cat, COUNT(*)::int AS n FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
          WHERE LOWER(e.recorded_by) = ${who} AND e.day >= ${since} AND e.value = 'Not done' GROUP BY 1`,
      sql`SELECT work_date, actual_in, actual_out FROM staff_times WHERE LOWER(staff_name) = ${who} AND work_date >= ${since} AND actual_in IS NOT NULL`,
      sql`SELECT COALESCE(SUM(price * COALESCE(quantity, 1)), 0)::float AS total, COUNT(*)::int AS n FROM live_sale_taps WHERE LOWER(staff_name) = ${who} AND NOT COALESCE(undone, false) AND tapped_at >= ${since}::date`,
    ])

    // Missed: the tasks that fell on this person and were not done (nobody did them), day by day since the checklist began.
    const byArea = new Map<string, { cat: string; done: number; notDone: number; missed: number }>()
    const row = (cat: string) => { let r = byArea.get(cat); if (!r) { r = { cat, done: 0, notDone: 0, missed: 0 }; byArea.set(cat, r) } return r }
    for (const r of doneRows) row(String(r.cat)).done += Number(r.n)
    for (const r of notDoneRows) row(String(r.cat)).notDone += Number(r.n)
    const days: string[] = []
    for (let i = 1; i <= DAYS; i++) { const d = addDays(today, -i); if (d >= CHECKLIST_START) days.push(d) }
    // A task is counted as missed only on a day the person was at the shop (clocked in): a manager-only task does not count against Joe on his day off.
    const worked = new Set(times.map(t => String(t.work_date).slice(0, 10)))
    const workedDays = days.filter(d => worked.has(d))
    for (let i = 0; i < workedDays.length; i += 6) {
      const chunk = await Promise.all(workedDays.slice(i, i + 6).map(d => dutiesForDate(d).catch(() => [])))
      for (const du of chunk) for (const t of du) if (t.kind === 'task' && t.state === 'miss' && String(t.owner ?? '').toLowerCase() === who) row(t.category ?? 'Other').missed += 1
    }
    const areas = Array.from(byArea.values()).sort((a, b) => (b.missed + b.notDone) - (a.missed + a.notDone) || b.done - a.done)
    const tot = areas.reduce((a, r) => ({ done: a.done + r.done, notDone: a.notDone + r.notDone, missed: a.missed + r.missed }), { done: 0, notDone: 0, missed: 0 })

    let minutes = 0, fullDays = 0
    for (const t of times) { const a = toMin(t.actual_in), b = toMin(t.actual_out); if (a != null && b != null && b > a) { minutes += b - a; fullDays += 1 } }
    const reasons = viol.map(v => String(v.reason))
    const data = {
      who, days: DAYS, counting: today >= st.startCounting, startCounting: st.startCounting,
      points: { total: points, entries: viol.map(v => ({ day: String(v.day), points: Number(v.points), reason: String(v.reason), status: String(v.status) })) },
      tasks: { ...tot, areas },
      time: { daysWorked: new Set(times.map(t => String(t.work_date))).size, minutes, fullDays },
      attendance: { late: reasons.filter(r => /^Late without/i.test(r)).length, absent: reasons.filter(r => /^Absent without/i.test(r)).length, backdated: reasons.filter(r => /^Clock-in time written/i.test(r)).length },
      sales: { total: Number(sales[0]?.total ?? 0), count: Number(sales[0]?.n ?? 0) },
    }
    cache.set(who, { at: Date.now(), data })
    return success(data)
  } catch (e) { return handleError('person-summary', e) }
}
