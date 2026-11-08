import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, CHECKLIST_START, dayKey, parseTileBody } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { getClockState, actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'


// GET ?day=YYYY-MM-DD -> { tiles, events } : every tile, and the records that can still count on that day
// (that year's, plus one-off tasks done at any time).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const q = req.nextUrl.searchParams.get('day') ?? ''
    const today = dayKey()
    const day = /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= CHECKLIST_START && q <= today ? q : today
    const tiles = await sql`SELECT id, section, time, title, icon, how, kind, prop_filter, frequency, weekday, position, minutes, days, ask, ok_label, issue_label, log_category, needs_photo, category, subcategory, law_id FROM daily_check_tiles WHERE active ORDER BY position, id`
    const events = await sql`
      SELECT e.id, e.tile_id, e.day, e.value, e.note, e.extra, e.recorded_by, e.recorded_at
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day <= ${day} AND (e.day >= ${day.slice(0, 4) + '-01-01'} OR t.frequency = 'once') ORDER BY e.recorded_at, e.id`
    const clock = await getClockState(today)
    const me = actorKey(session.user as any)
    const exempt = (session.user as { role?: string })?.role === 'owner'
    return success({ day, today, tiles, events, dayStart: clock.dayStart, clockedIn: exempt || clock.present.includes(me), exempt, present: clock.present })
  } catch (e) { return handleError('daily-checks GET', e) }
}

// POST (owner and manager) -- add a tile. Body fields: see parseTileBody in lib/dailyChecks.ts.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can change the checklist.')
  try {
    await ensureDailyChecks()
    const t = parseTileBody(await req.json().catch(() => ({})))
    if (!t.title || !t.section) return badRequest('Need a group and a title.')
    const [row] = await sql`INSERT INTO daily_check_tiles
      (section, time, title, icon, how, kind, prop_filter, frequency, weekday, days, position, created_by, minutes, ask, ok_label, issue_label, log_category, needs_photo)
      VALUES (${t.section}, ${t.time}, ${t.title}, ${t.icon}, ${t.how}, ${t.kind}, ${t.prop_filter}, ${t.frequency}, ${t.weekday}, ${t.days},
              (SELECT COALESCE(MAX(position), 0) + 1 FROM daily_check_tiles), ${getActorName(session)}, ${t.minutes}, ${t.ask}, ${t.ok_label}, ${t.issue_label}, ${t.log_category}, ${t.needs_photo})
      RETURNING id`
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('daily-checks POST', e) }
}
