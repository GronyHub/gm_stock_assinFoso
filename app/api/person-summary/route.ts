import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import sql from '@/lib/db'
import { ensurePenalties, totalPoints, getSettings } from '@/lib/penalties'
import { dutiesForDate } from '@/lib/duties'
import { weekStart } from '@/lib/countQuota'
import { addDays, dayKey, CHECKLIST_START } from '@/lib/dailyChecksShared'

// GET ?who=james&from=2026-11-01&to=2026-11-24 -- the read-only summary of one person for the Waiting page. A staff member can read only their own; the owner and Joe can read anyone's
// (and also get the team average beside each number). The figures for every staff member over one period are worked out together and kept for 20 minutes.
const MAX_DAYS = 92
const TTL = 20 * 60 * 1000
const toMin = (t: unknown) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
const DATE = /^\d{4}-\d{2}-\d{2}$/

type Missed = { day: string; time: string; title: string; category: string | null; law_id: number | null }
type Base = { done: number; notDone: number; missed: number; areas: Map<string, { cat: string; done: number; notDone: number; missed: number }>; missedList: Missed[]
  points: number; pointsEntries: number; daysWorked: number; minutes: number; fullDays: number; sales: number; salesN: number; late: number; absent: number; backdated: number }
const cache = new Map<string, { at: number; staff: string[]; per: Map<string, Base> }>()

async function computeBase(from: string, to: string) {
  const key = `${from}|${to}`, hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit
  const staff = (await sql`SELECT LOWER(username) AS u FROM app_users WHERE active IS NOT FALSE AND role NOT IN ('owner', 'children_manager')`).map(r => String(r.u))
  const per = new Map<string, Base>()
  for (const s of staff) per.set(s, { done: 0, notDone: 0, missed: 0, areas: new Map(), missedList: [], points: 0, pointsEntries: 0, daysWorked: 0, minutes: 0, fullDays: 0, sales: 0, salesN: 0, late: 0, absent: 0, backdated: 0 })
  const area = (b: Base, cat: string) => { let r = b.areas.get(cat); if (!r) { r = { cat, done: 0, notDone: 0, missed: 0 }; b.areas.set(cat, r) } return r }
  const [ev, times, pens, sales] = await Promise.all([
    sql`SELECT LOWER(e.recorded_by) AS who, COALESCE(t.category, 'Other') AS cat, (e.value = 'Not done') AS nd, COUNT(*)::int AS n FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
        WHERE e.day >= ${from} AND e.day <= ${to} AND COALESCE(e.extra->>'confirm', '') <> 'rejected' GROUP BY 1, 2, 3`,
    sql`SELECT LOWER(staff_name) AS who, work_date, actual_in, actual_out FROM staff_times WHERE work_date >= ${from} AND work_date <= ${to} AND actual_in IS NOT NULL`,
    sql`SELECT staff, reason, points FROM staff_penalties WHERE kind = 'violation' AND status IN ('active', 'pending', 'disputed') AND day >= ${from} AND day <= ${to}`,
    sql`SELECT LOWER(staff_name) AS who, COALESCE(SUM(price * COALESCE(quantity, 1)), 0)::float AS total, COUNT(*)::int AS n FROM live_sale_taps WHERE NOT COALESCE(undone, false) AND tapped_at >= ${from}::date AND tapped_at < (${to}::date + 1) GROUP BY 1`,
  ])
  for (const r of ev) { const b = per.get(String(r.who)); if (!b) continue; if (r.nd) { b.notDone += Number(r.n); area(b, String(r.cat)).notDone += Number(r.n) } else { b.done += Number(r.n); area(b, String(r.cat)).done += Number(r.n) } }
  const workedBy = new Map<string, Set<string>>()
  for (const t of times) {
    const who = String(t.who), b = per.get(who); if (!b) continue
    const d = String(t.work_date).slice(0, 10); (workedBy.get(who) ?? workedBy.set(who, new Set()).get(who)!).add(d)
    const a = toMin(t.actual_in), z = toMin(t.actual_out); if (a != null && z != null && z > a) { b.minutes += z - a; b.fullDays += 1 }
  }
  for (const [who, set] of workedBy) per.get(who)!.daysWorked = set.size
  for (const p of pens) { const b = per.get(String(p.staff).toLowerCase()); if (!b) continue; const r = String(p.reason); b.points += Number(p.points); b.pointsEntries += 1
    if (/^Late without/i.test(r)) b.late += 1; else if (/^Absent without/i.test(r)) b.absent += 1; else if (/^Clock-in time written/i.test(r)) b.backdated += 1 }
  for (const s of sales) { const b = per.get(String(s.who)); if (b) { b.sales = Number(s.total); b.salesN = Number(s.n) } }
  // Missed: a task that fell on someone and nobody did, counted only on a day that person was at the shop.
  const days: string[] = []
  for (let d = from; d <= to && d < dayKey(); d = addDays(d, 1)) if (d >= CHECKLIST_START) days.push(d)
  for (let i = 0; i < days.length; i += 6) {
    const chunk = await Promise.all(days.slice(i, i + 6).map(async d => ({ d, du: await dutiesForDate(d).catch(() => []) })))
    for (const { d, du } of chunk) for (const t of du) {
      if (t.kind !== 'task' || t.state !== 'miss') continue
      const who = String(t.owner ?? '').toLowerCase(), b = per.get(who)
      if (!b || !workedBy.get(who)?.has(d)) continue
      b.missed += 1; area(b, t.category ?? 'Other').missed += 1
      if (b.missedList.length < 300) b.missedList.push({ day: d, time: t.time, title: t.title, category: t.category, law_id: t.lawId })
    }
  }
  const out = { at: Date.now(), staff, per }
  cache.set(key, out)
  return out
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase(), owner = isOwnerLevel(session.user as never)
    const who = String(req.nextUrl.searchParams.get('who') ?? me).toLowerCase().trim()
    if (!who || !/^[a-z0-9_.-]{1,40}$/.test(who)) return badRequest('Whose?')
    if (who !== me && !owner) return badRequest('You can see only your own summary.')
    const today = dayKey()
    let to = String(req.nextUrl.searchParams.get('to') ?? today), from = String(req.nextUrl.searchParams.get('from') ?? addDays(today, -30))
    if (!DATE.test(to) || to > today) to = today
    if (!DATE.test(from)) from = addDays(to, -30)
    if (from > to) from = to
    if ((new Date(to).getTime() - new Date(from).getTime()) / 86400000 > MAX_DAYS) from = addDays(to, -MAX_DAYS)

    await ensurePenalties()
    const st = await getSettings()
    const base = await computeBase(from, to)
    const b = base.per.get(who) ?? { done: 0, notDone: 0, missed: 0, areas: new Map(), missedList: [], points: 0, pointsEntries: 0, daysWorked: 0, minutes: 0, fullDays: 0, sales: 0, salesN: 0, late: 0, absent: 0, backdated: 0 } as Base

    const [total, entries, byLaw, byMonth, doneList, timeRows, latePens, salesDay, salesGroup] = await Promise.all([
      totalPoints(who),
      sql`SELECT day, points, reason, status FROM staff_penalties WHERE staff = ${who} AND kind = 'violation' AND status IN ('active', 'pending', 'disputed') AND day >= ${from} AND day <= ${to} ORDER BY day DESC, id DESC LIMIT 60`,
      sql`SELECT p.law_id, COALESCE(NULLIF(l.title, ''), left(l.text, 90), 'Not tied to one law') AS name, SUM(p.points)::int AS points, COUNT(*)::int AS n FROM staff_penalties p LEFT JOIN page_laws l ON l.id = p.law_id
          WHERE p.staff = ${who} AND p.kind = 'violation' AND p.status IN ('active', 'pending', 'disputed') AND p.day >= ${from} AND p.day <= ${to} GROUP BY 1, 2 ORDER BY 3 DESC, 4 DESC LIMIT 30`,
      sql`SELECT substr(day::text, 1, 7) AS month, SUM(points)::int AS points, COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${who} AND kind = 'violation' AND status IN ('active', 'pending', 'disputed') AND day >= ${from} AND day <= ${to} GROUP BY 1 ORDER BY 1 DESC`,
      sql`SELECT e.day, e.recorded_at, e.value, e.note, t.title, t.category, t.law_id FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
          WHERE LOWER(e.recorded_by) = ${who} AND e.day >= ${from} AND e.day <= ${to} AND COALESCE(e.extra->>'confirm', '') <> 'rejected' ORDER BY e.day DESC, e.recorded_at DESC LIMIT 300`,
      sql`SELECT work_date, actual_in, actual_out FROM staff_times WHERE LOWER(staff_name) = ${who} AND work_date >= ${from} AND work_date <= ${to} AND actual_in IS NOT NULL ORDER BY work_date DESC`,
      sql`SELECT reason FROM staff_penalties WHERE staff = ${who} AND kind = 'violation' AND reason ILIKE 'Late without%' AND day >= ${from} AND day <= ${to}`,
      sql`SELECT tapped_at::date::text AS day, COALESCE(SUM(price * COALESCE(quantity, 1)), 0)::float AS total, COUNT(*)::int AS n FROM live_sale_taps WHERE LOWER(staff_name) = ${who} AND NOT COALESCE(undone, false) AND tapped_at >= ${from}::date AND tapped_at < (${to}::date + 1) GROUP BY 1 ORDER BY 1 DESC`,
      sql`SELECT COALESCE(i.cf_group, 'No group') AS grp, COALESCE(SUM(t.price * COALESCE(t.quantity, 1)), 0)::float AS total, COUNT(*)::int AS n FROM live_sale_taps t LEFT JOIN items i ON i.id = t.item_id
          WHERE LOWER(t.staff_name) = ${who} AND NOT COALESCE(t.undone, false) AND t.tapped_at >= ${from}::date AND t.tapped_at < (${to}::date + 1) GROUP BY 1 ORDER BY 2 DESC LIMIT 20`,
    ])

    // Lateness in minutes, from the point entries ("rostered 08:00, clocked in 09:10").
    const lateByDay = new Map<string, number>()
    for (const p of latePens) { const m = /on (\d{4}-\d{2}-\d{2}) \(rostered (\d\d:\d\d), clocked in (\d\d:\d\d)\)/.exec(String(p.reason)); if (m) { const a = toMin(m[2])!, z = toMin(m[3])!; if (z > a) lateByDay.set(m[1], z - a) } }
    const perDay = timeRows.map(r => { const d = String(r.work_date).slice(0, 10), a = toMin(r.actual_in), z = toMin(r.actual_out); return { day: d, in: r.actual_in ? String(r.actual_in).slice(0, 5) : null, out: r.actual_out ? String(r.actual_out).slice(0, 5) : null, minutes: a != null && z != null && z > a ? z - a : null, lateMin: lateByDay.get(d) ?? 0 } })
    const weeks = new Map<string, { week: string; minutes: number; days: number; lateMin: number }>()
    for (const d of perDay) { const w = weekStart(d.day); const r = weeks.get(w) ?? { week: w, minutes: 0, days: 0, lateMin: 0 }; r.minutes += d.minutes ?? 0; r.days += 1; r.lateMin += d.lateMin; weeks.set(w, r) }

    const tasks = [
      ...doneList.map(r => ({ day: String(r.day).slice(0, 10), time: new Date(r.recorded_at).toISOString().slice(11, 16), title: String(r.title), category: (r.category as string | null) ?? null, law_id: (r.law_id as number | null) ?? null, outcome: r.value === 'Not done' ? 'notDone' : 'done', note: (r.note as string | null) ?? null })),
      ...b.missedList.map(m => ({ ...m, outcome: 'missed', note: null as string | null })),
    ].sort((x, y) => y.day.localeCompare(x.day) || y.time.localeCompare(x.time)).slice(0, 400)

    const areas = Array.from(b.areas.values()).sort((x, y) => (y.missed + y.notDone) - (x.missed + x.notDone) || y.done - x.done)
    let team: Record<string, number> | null = null
    if (owner) {
      const all = Array.from(base.per.values()), n = Math.max(1, all.length), avg = (f: (x: Base) => number) => Math.round(all.reduce((a, x) => a + f(x), 0) / n * 10) / 10
      team = { people: all.length, done: avg(x => x.done), notDone: avg(x => x.notDone), missed: avg(x => x.missed), points: avg(x => x.points), minutes: avg(x => x.minutes), daysWorked: avg(x => x.daysWorked), sales: avg(x => x.sales), late: avg(x => x.late), absent: avg(x => x.absent), backdated: avg(x => x.backdated) }
    }
    return success({
      who, from, to, counting: today >= st.startCounting, startCounting: st.startCounting, team,
      points: { total, inRange: b.points, entries: entries.map(v => ({ day: String(v.day).slice(0, 10), points: Number(v.points), reason: String(v.reason), status: String(v.status) })), byLaw, byMonth },
      tasks: { done: b.done, notDone: b.notDone, missed: b.missed, areas, list: tasks },
      time: { daysWorked: b.daysWorked, minutes: b.minutes, fullDays: b.fullDays, perDay, perWeek: Array.from(weeks.values()).sort((x, y) => y.week.localeCompare(x.week)) },
      attendance: { late: b.late, absent: b.absent, backdated: b.backdated },
      sales: { total: b.sales, count: b.salesN, perDay: salesDay, byGroup: salesGroup },
    })
  } catch (e) { return handleError('person-summary', e) }
}
