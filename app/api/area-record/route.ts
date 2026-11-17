import { NextRequest } from 'next/server'
import { actorKey } from '@/lib/clockState'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties } from '@/lib/penalties'
import { ensureDailyChecks } from '@/lib/dailyChecks'
import { LAW_AREAS } from '@/lib/lawAreas'
import { isOwnerLevel } from '@/lib/roles'

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
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)

    const points = (await sql`
      SELECT p.id, p.staff, p.points, p.reason, p.day, p.status, p.law_code, p.law_id, l.title AS law_title
      FROM staff_penalties p JOIN page_laws l ON l.id = p.law_id
      WHERE l.category = ANY(${cats}) AND p.kind = 'violation' AND p.status IN ('active', 'pending') AND p.day >= ${since}
      ORDER BY p.day DESC, p.id DESC LIMIT 300`).filter(r => all || String(r.staff).toLowerCase() === me)

    const done = (await sql`
      SELECT t.id AS tile_id, t.title, t.law_id, e.day, e.recorded_by, e.value
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE t.category = ANY(${cats}) AND e.day >= ${since}
      ORDER BY e.day DESC, e.id DESC LIMIT 400`).filter(r => all || String(r.recorded_by).toLowerCase() === me)

    const people: Record<string, { points: number; done: number }> = {}
    for (const p of points) { const k = String(p.staff).toLowerCase(); (people[k] ??= { points: 0, done: 0 }).points += Number(p.points) }
    for (const d of done) { const k = String(d.recorded_by).toLowerCase(); (people[k] ??= { points: 0, done: 0 }).done += 1 }

    return success({ days, all, area: { key: area.key, label: area.label }, people, points, done })
  } catch (e) { return handleError('area-record', e) }
}
