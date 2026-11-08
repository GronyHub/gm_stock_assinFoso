import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, ensureAdhoc, dayKey, CHECKLIST_START, appliesOn } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// GET ?day=YYYY-MM-DD -- end-of-day report for owner-level: what each person did (and the work minutes it earned),
// and which of the day's timed tasks were missed.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Owner and manager only.')
  try {
    await ensureDailyChecks()
    const q = req.nextUrl.searchParams.get('day') ?? ''
    const today = dayKey()
    const day = /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= CHECKLIST_START && q <= today ? q : today
    const people = await sql`
      SELECT e.recorded_by AS person, COUNT(*)::int AS done, COALESCE(SUM(t.minutes), 0)::int AS minutes
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day = ${day} AND e.value = 'Done' GROUP BY e.recorded_by ORDER BY done DESC`
    const missed = await sql`
      SELECT t.id, t.section, t.time, t.icon, t.title, t.days FROM daily_check_tiles t
      WHERE t.active AND t.frequency = 'daily' AND t.kind <> 'properties'
        AND NOT EXISTS (SELECT 1 FROM daily_check_events e WHERE e.tile_id = t.id AND e.day = ${day} AND e.value = 'Done')
      ORDER BY t.time NULLS LAST, t.id`
    const all = await sql`SELECT days FROM daily_check_tiles WHERE active AND frequency = 'daily' AND kind <> 'properties'`
    const total = (all as { days: string | null }[]).filter(t => appliesOn(t, day)).length
    const missedToday = (missed as { days: string | null }[]).filter(t => appliesOn(t, day))
    await ensureAdhoc()
    const adhoc = await sql`SELECT id, category, note, minutes, credited, recorded_by FROM daily_adhoc WHERE day = ${day} ORDER BY recorded_at`
    return success({ day, total, adhoc, done: total - missedToday.length, people, missed: missedToday })
  } catch (e) { return handleError('daily-checks report', e) }
}
