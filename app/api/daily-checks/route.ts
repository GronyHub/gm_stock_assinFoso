import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, ensureAdhoc, CHECKLIST_START, dayKey, parseTileBody } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { getClockState, actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'
import { isManagerName } from '@/lib/signers'


// GET ?day=YYYY-MM-DD -> { tiles, events } : every tile, and the records that can still count on that day
// (that year's, plus one-off tasks done at any time).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    await ensureCompanyLaws().catch(() => {}) // laws that have been approved create their tiles here the first time
    const mgr = isManagerName(actorKey(session.user as any)) || (session.user as { role?: string })?.role === 'owner'
    const q = req.nextUrl.searchParams.get('day') ?? ''
    const today = dayKey()
    const day = /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= CHECKLIST_START && q <= today ? q : today
    const tiles = await sql`SELECT id, section, time, title, icon, how, kind, prop_filter, frequency, weekday, position, minutes, days, ask, ok_label, issue_label, log_category, needs_photo, category, subcategory, law_id, assignment FROM daily_check_tiles WHERE active AND (${mgr} OR law_id IS NULL OR law_id NOT IN (SELECT id FROM page_laws WHERE audience = 'managers')) ORDER BY position, id`
    const events = await sql`
      SELECT e.id, e.tile_id, e.day, e.value, e.note, e.extra, e.recorded_by, e.recorded_at
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day <= ${day} AND (e.day >= ${day.slice(0, 4) + '-01-01'} OR t.frequency = 'once') ORDER BY e.recorded_at, e.id`
    await ensureAdhoc()
    const adhoc = await sql`SELECT id, category, note, photo_url, minutes, credited, recorded_by, recorded_at FROM daily_adhoc WHERE day = ${day} ORDER BY recorded_at`
    const clock = await getClockState(today)
    const me = actorKey(session.user as any)
    const exempt = (session.user as { role?: string })?.role === 'owner'
    return success({ day, today, tiles, events, adhoc, dayStart: clock.dayStart, clockedIn: exempt || clock.present.includes(me), exempt, present: clock.present, opener: clock.opener, closer: clock.lastOut })
  } catch (e) { return handleError('daily-checks GET', e) }
}

// POST -- tasks are no longer made here. Every task rests on a law (the owner's rule): a task is added by giving a recurring law a time, in the Company Laws.
export async function POST() {
  const { error } = await requireAuth()
  if (error) return error
  return badRequest('Tasks come from the laws. Add or edit a recurring law in the Company Laws and give it a time.')
}
