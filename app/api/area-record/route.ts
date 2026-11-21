import { NextRequest } from 'next/server'
import { actorKey } from '@/lib/clockState'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties } from '@/lib/penalties'
import { ensureDailyChecks } from '@/lib/dailyChecks'
import { LAW_AREAS } from '@/lib/lawAreas'
import { isOwnerLevel } from '@/lib/roles'
import { dutiesForDate } from '@/lib/duties'
import { ensureFinanceChecks } from '@/lib/financeChecks'
import { addDays, dayKey, CHECKLIST_START } from '@/lib/dailyChecksShared'

// GET ?area=clean&days=30 -- how the laws of one area went: the penalty points they produced and which of the area's
// daily duties were recorded as done. Joe and Grony see everyone; each staff member sees only their own.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const q = req.nextUrl.searchParams
    const area = LAW_AREAS.find(a => a.key === q.get('area'))
    if (!area) return badRequest('Unknown area')
    const days = Math.min(90, Math.max(1, Number(q.get('days')) || 30))
    const all = isOwnerLevel(session.user as never)
    const me = actorKey(session.user as never).toLowerCase()
    await ensurePenalties(); await ensureDailyChecks()
    const cats = Array.from(new Set(area.match.map(m => m.cat)))
    // Optional: only these subcategories of the area (an area that is part of a wider law category).
    const subs = (q.get('subs') ?? '').split('|').filter(Boolean)
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    const points = (await sql`
      SELECT p.id, p.staff, p.points, p.reason, p.day, p.status, p.law_code, p.law_id, l.title AS law_title
      FROM staff_penalties p JOIN page_laws l ON l.id = p.law_id
      WHERE l.category = ANY(${cats}) AND (${subs.length === 0} OR l.subcategory = ANY(${subs})) AND p.kind = 'violation' AND p.status IN ('active', 'pending') AND p.day >= ${since}
      ORDER BY p.day DESC, p.id DESC LIMIT 300`).filter(r => all || String(r.staff).toLowerCase() === me)

    const done = (await sql`
      SELECT t.id AS tile_id, t.title, t.law_id, e.day, e.recorded_by, e.value, e.note, e.extra->>'photo_url' AS photo, e.recorded_at
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE t.category = ANY(${cats}) AND (${subs.length === 0} OR t.subcategory = ANY(${subs})) AND e.day >= ${since} AND e.value <> 'Not done'
      ORDER BY e.day DESC, e.id DESC LIMIT 400`).filter(r => all || String(r.recorded_by).toLowerCase() === me)

    // Not done: this area's daily duties that were missed (nobody did them, or they were answered 'Not done' with a reason).
    // Only the last 30 days and only since the checklist began; each duty is the one person it fell on.
    const subSet = new Set(subs)
    const lawSubs = subs.length ? new Map((await sql`SELECT id, subcategory FROM page_laws WHERE id IN (SELECT law_id FROM daily_check_tiles WHERE law_id IS NOT NULL)`).map(r => [Number(r.id), String(r.subcategory ?? '')])) : null
    const today = dayKey()
    const dayList: string[] = []
    for (let i = 0; i < Math.min(days, 30); i++) { const d = addDays(today, -i); if (d >= CHECKLIST_START) dayList.push(d) }
    const missed: { day: string; title: string; owner: string | null; reason: string | null; state: string }[] = []
    for (let i = 0; i < dayList.length; i += 6) {
      const chunk = await Promise.all(dayList.slice(i, i + 6).map(async d => ({ d, du: await dutiesForDate(d).catch(() => []) })))
      for (const { d, du } of chunk) for (const t of du) {
        if (!t.category || !cats.includes(t.category)) continue
        if (lawSubs && !(t.lawId && subSet.has(lawSubs.get(t.lawId) ?? ''))) continue
        if (t.state !== 'miss' && t.state !== 'no' && !(d === today && t.state === 'late')) continue
        const who = (t.owner ?? '').toLowerCase()
        if (!all && who !== me) continue
        missed.push({ day: d, title: t.title, owner: t.owner, reason: t.state === 'no' ? t.note ?? null : null, state: t.state })
      }
    }
    // Expenses and Bills: the manager's login checks (have you recorded everything?) are part of the record. A yes, or going to record the rest, is Done; a skip is Not done.
    if (area.key === 'expenses' || area.key === 'bills') {
      await ensureFinanceChecks()
      const what = area.key, cap = area.key === 'expenses' ? 'Expenses' : 'Bills'
      const checks = await sql`SELECT who, answer, action, day, created_at FROM finance_checks WHERE kind = ${area.key} AND day >= ${since} ORDER BY id DESC LIMIT 200` as unknown as { who: string; answer: string; action: string | null; day: string; created_at: string }[]
      for (const c of checks.filter(c => all || c.who.toLowerCase() === me)) {
        if (c.answer === 'yes') done.push({ tile_id: 0, title: `Confirmed all ${what} are recorded`, law_id: null, day: c.day, recorded_by: c.who, value: 'Yes', note: null, photo: null, recorded_at: c.created_at })
        else if (c.action === 'record_now') done.push({ tile_id: 0, title: `Some ${what} were not recorded: opened ${cap} to record them`, law_id: null, day: c.day, recorded_by: c.who, value: 'Yes', note: null, photo: null, recorded_at: c.created_at })
        else missed.push({ day: c.day, title: `${cap} check skipped`, owner: c.who, reason: c.answer === 'no' ? `Said some ${what} are not recorded yet, and skipped` : null, state: 'miss' })
      }
      done.sort((a, b) => String(b.day).localeCompare(String(a.day)))
    }
    missed.sort((a, b) => b.day.localeCompare(a.day))

    const people: Record<string, { points: number; done: number; missed: number }> = {}
    for (const p of points) { const k = String(p.staff).toLowerCase(); (people[k] ??= { points: 0, done: 0, missed: 0 }).points += Number(p.points) }
    for (const d of done) { const k = String(d.recorded_by).toLowerCase(); (people[k] ??= { points: 0, done: 0, missed: 0 }).done += 1 }
    for (const m of missed) { const k = (m.owner ?? 'nobody').toLowerCase(); (people[k] ??= { points: 0, done: 0, missed: 0 }).missed += 1 }

    return success({ days, all, area: { key: area.key, label: area.label }, people, points, done, missed, missedDays: dayList.length })
  } catch (e) { return handleError('area-record', e) }
}
