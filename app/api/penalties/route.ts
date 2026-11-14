import { actorKey } from '@/lib/clockState'
import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePenalties, getSettings, totalPoints, addPoint } from '@/lib/penalties'
import { pushToUsers, notifyOwners } from '@/lib/checklistAlerts'
import { canLogAgainst, logsNeedConfirm } from '@/lib/violationLog'
import { parseViolations } from '@/lib/lawViolations'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

const APP_CHECKED = 'The app already checks this law and gives the point itself.'

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
      const [pl] = await sql`SELECT COALESCE(SUM(points), 0)::int AS t FROM staff_penalties WHERE staff = ${p.staff} AND status = 'active' AND NOT counted AND kind = 'violation'`
      rows.push({ ...p, points: await totalPoints(p.staff), warnings: Number(w?.n ?? 0), pilot: Number(pl?.t ?? 0) })
    }
    const pending = await sql`SELECT id, staff, points, reason, day, created_by, status, dispute_note FROM staff_penalties WHERE status IN ('pending', 'disputed') ORDER BY id DESC`
    const sanctions = await sql`SELECT id, staff, tier, points_at, status, days, hours, start_date, end_date, created_at FROM penalty_sanctions WHERE status IN ('proposed', 'approved') ORDER BY id DESC LIMIT 30`
    const recent = await sql`SELECT id, staff, points, kind, reason, source, day, counted, status, created_by FROM staff_penalties ORDER BY id DESC LIMIT 200`
    const laws = await sql`SELECT id, text, category, points FROM page_laws WHERE status = 'live' AND category IS NOT NULL ORDER BY category, id`.catch(() => [])
    return success({ me: actorKey(session.user as any), settings: st, people: rows, pending, sanctions, recent, laws })
  } catch (e) { return handleError('penalties GET', e) }
}

// POST { staff | staffs[], law_id, violation_index, note, day? } -- a manager logs a violation they saw, in the shop or on the CCTV.
// The law and its violation line set the points. Owners log anyone; Bino logs James only (and the owner confirms it); see lib/violationLog.ts.
// The old form { staff, reason, points?, law_id? } still works for the owner.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const staffs: string[] = (Array.isArray(b.staffs) ? b.staffs : [b.staff]).map((x: unknown) => String(x ?? '').trim().toLowerCase()).filter(Boolean)
    const note = String(b.note ?? b.reason ?? '').trim().slice(0, 300)
    if (!staffs.length || note.length < 4) return badRequest('Choose who, and write a note saying what you saw.')
    for (const st of staffs) if (!canLogAgainst(session.user as any, st)) return badRequest(`You cannot log a violation against ${st}.`)
    const day = /^\d{4}-\d{2}-\d{2}$/.test(String(b.day ?? '')) ? String(b.day) : undefined
    const lawId = Number(b.law_id) || null
    let points = Math.round(Number(b.points)), reason = note, violation: string | undefined, lawCode: string | null = null
    if (lawId) {
      const [l] = await sql`SELECT code, text, points, violations, law_type FROM page_laws WHERE id = ${lawId}`
      if (!l) return badRequest('That law no longer exists.')
      const vs = parseViolations(l.violations)
      const v = vs[Number(b.violation_index)]
      if (vs.length && !v) return badRequest('Choose which violation it was.')
      // A law the app checks itself already gives its own point: a manual one would charge twice.
      if (l.law_type === 'app' || v?.by === 'app' || (!v && vs.length > 0 && vs.every(x => x.by === 'app'))) return badRequest(APP_CHECKED)
      if (v && v.points === 0) return badRequest('That rule has no penalty, so no point can be logged for it.')
      if (v) { violation = v.text; points = v.points } else if (!Number.isFinite(points) || points < 1) points = Number(l.points) || 1
      lawCode = (l.code as string | null) ?? null
      reason = `${lawCode ? lawCode + ': ' : ''}${violation ?? String(l.text).slice(0, 80)}. ${note}`.slice(0, 300)
    }
    const max = points >= 50 ? 50 : 20
    if (!Number.isFinite(points) || points < 1 || points > max) points = 1
    const by = getActorName(session), confirm = logsNeedConfirm(session.user as any)
    // The app already gave an automatic point for this law, person and day: refuse the manual one.
    if (lawId) {
      const onDay = day ?? new Date().toISOString().slice(0, 10)
      const [auto] = await sql`SELECT 1 FROM staff_penalties WHERE staff = ANY(${staffs}) AND law_id = ${lawId} AND day = ${onDay} AND source <> 'manual' AND status IN ('active', 'pending') LIMIT 1`
      if (auto) return badRequest(APP_CHECKED)
      // The day-end "tasks left undone" point carries no law id: a law whose checklist task was not done that day is already in it.
      const [missed] = await sql`SELECT 1 FROM staff_penalties p JOIN page_laws l ON l.id = ${lawId} AND l.tile_id IS NOT NULL
        WHERE p.staff = ANY(${staffs}) AND p.ref = ${'missed:' + onDay} AND p.status IN ('active', 'pending')
        AND NOT EXISTS (SELECT 1 FROM daily_check_events e WHERE e.tile_id = l.tile_id AND e.day = ${onDay} AND e.value = 'Done') LIMIT 1`.catch(() => [])
      if (missed) return badRequest(APP_CHECKED)
    }
    const rows = []
    for (const staff of staffs) {
      const row = await addPoint({ staff, points, reason, source: 'manual', lawId, by, violation, lawCode, day, status: confirm ? 'pending' : 'active' })
      if (row) {
        rows.push(row)
        if (actorKey(session.user as any) === 'joe') void pushToUsers(['grony'], `Joe logged a violation against ${staff}`, reason)
        void pushToUsers([staff], 'A violation was logged', `${reason}. Open your profile to acknowledge or dispute it.`)
        if (confirm) void notifyOwners(`Violation to confirm: ${staff}`, `${by} logged: ${reason}`)
      }
    }
    return success({ logged: rows.length, rows }, 201)
  } catch (e) { return handleError('penalties POST', e) }
}
