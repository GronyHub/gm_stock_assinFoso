import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties, getSettings, totalPoints, addPoint } from '@/lib/penalties'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// GET (owner and manager) -- everyone's points, items waiting for a decision, and the latest entries.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can see this.')
  try {
    await ensurePenalties()
    const st = await getSettings()
    const people = await sql`SELECT LOWER(username) AS staff, display_name, role FROM app_users WHERE active IS NOT FALSE AND role <> 'children_manager' AND role <> 'owner' ORDER BY id` as unknown as { staff: string; display_name: string; role: string }[]
    const rows = []
    for (const p of people) {
      const [w] = await sql`SELECT COUNT(*)::int AS n FROM staff_penalties WHERE staff = ${p.staff} AND status = 'active' AND NOT counted AND kind = 'violation'`
      rows.push({ ...p, points: await totalPoints(p.staff), warnings: Number(w?.n ?? 0) })
    }
    const pending = await sql`SELECT id, staff, points, reason, day, created_by FROM staff_penalties WHERE status = 'pending' ORDER BY id DESC`
    const sanctions = await sql`SELECT id, staff, tier, points_at, status, days, hours, start_date, end_date, created_at FROM penalty_sanctions WHERE status IN ('proposed', 'approved') ORDER BY id DESC LIMIT 30`
    const recent = await sql`SELECT id, staff, points, kind, reason, source, day, counted, status, created_by FROM staff_penalties ORDER BY id DESC LIMIT 60`
    const laws = await sql`SELECT id, text, category, points FROM page_laws WHERE status = 'live' AND category IS NOT NULL ORDER BY category, id`.catch(() => [])
    return success({ settings: st, people: rows, pending, sanctions, recent, laws })
  } catch (e) { return handleError('penalties GET', e) }
}

// POST { staff, reason, points?, law_id? } -- the owner or manager records a violation by hand.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can record a violation.')
  try {
    const b = await req.json().catch(() => ({}))
    const staff = String(b.staff ?? '').trim().toLowerCase(), reason = String(b.reason ?? '').trim().slice(0, 300)
    if (!staff || reason.length < 4) return badRequest('Choose the staff member and write the reason.')
    let points = Math.round(Number(b.points)); if (!Number.isFinite(points) || points < 1 || points > 20) points = 1
    const lawId = Number(b.law_id) || null
    if (lawId && !b.points) { const [l] = await sql`SELECT points FROM page_laws WHERE id = ${lawId}`; if (l?.points) points = Number(l.points) }
    const row = await addPoint({ staff, points, reason, source: 'manual', lawId, by: getActorName(session) })
    return success(row, 201)
  } catch (e) { return handleError('penalties POST', e) }
}
