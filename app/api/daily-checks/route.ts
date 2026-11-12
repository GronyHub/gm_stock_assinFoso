import { appliesOn, effectiveDue } from '@/lib/dailyChecksShared'
import { rotaShifts, allocatedTo } from '@/lib/allocation'
import { unmetConditions } from '@/lib/tileConditions'
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
    const allTiles = await sql`SELECT id, section, time, title, icon, how, kind, prop_filter, frequency, weekday, position, minutes, days, ask, ok_label, issue_label, log_category, needs_photo, category, subcategory, law_id, assignment, condition, (SELECT l.law_type FROM page_laws l WHERE l.id = daily_check_tiles.law_id) AS law_type FROM daily_check_tiles WHERE active AND (${mgr} OR law_id IS NULL OR law_id NOT IN (SELECT id FROM page_laws WHERE audience = 'managers')) ORDER BY position, id`
    const unmet = await unmetConditions()
    const tiles = (allTiles as unknown as { condition?: string | null }[]).filter(t => !t.condition || !unmet.has(t.condition))
    const events = await sql`
      SELECT e.id, e.tile_id, e.day, e.value, e.note, e.extra, e.recorded_by, e.recorded_at
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day <= ${day} AND (e.day >= ${day.slice(0, 4) + '-01-01'} OR t.frequency = 'once') ORDER BY e.recorded_at, e.id`
    await ensureAdhoc()
    const adhoc = await sql`SELECT id, category, note, photo_url, minutes, credited, recorded_by, recorded_at FROM daily_adhoc WHERE day = ${day} ORDER BY recorded_at`
    const clock = await getClockState(today)
    const me = actorKey(session.user as any)
    const exempt = (session.user as { role?: string })?.role === 'owner'
    // Today's shared tasks have one named person each (from the rota); the screen shows it on the tile.
    const alloc: Record<number, string> = {}
    if (day === today && clock.dayStart != null) {
      const shifts = await rotaShifts(today)
      const dayTiles = (tiles as unknown as { id: number; assignment?: string | null; time: string | null; minutes: number | null; frequency: string; kind: string; days: string | null }[]).filter(t => appliesOn(t as never, today))
      const dueMap = effectiveDue(dayTiles as never, clock.dayStart)
      for (const t of dayTiles) if ((t.assignment ?? 'all') === 'all' && dueMap.has(t.id)) { const n = allocatedTo(t.id, dueMap.get(t.id)!, clock, shifts); if (n) alloc[t.id] = n }
    }
    return success({ day, today, tiles, alloc, events, adhoc, dayStart: clock.dayStart, clockedIn: exempt || clock.present.includes(me), exempt, present: clock.present, opener: clock.opener, closer: clock.lastOut })
  } catch (e) { return handleError('daily-checks GET', e) }
}

// POST -- tasks are no longer made here. Every task rests on a law (the owner's rule): a task is added by giving a recurring law a time, in the Company Laws.
export async function POST() {
  const { error } = await requireAuth()
  if (error) return error
  return badRequest('Tasks come from the laws. Add or edit a recurring law in the Company Laws and give it a time.')
}
