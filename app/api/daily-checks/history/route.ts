import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, dayKey, addDays, CHECKLIST_START } from '@/lib/dailyChecks'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// GET ?from&to&section&person&q&issues=1 -- the checklist's history (owner and manager only): every record in the
// range with who did it, when and what they answered, plus a summary per task (times done, last done, by whom).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can view the history.')
  try {
    await ensureDailyChecks()
    const p = req.nextUrl.searchParams
    const ok = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
    const today = dayKey()
    const to = ok(p.get('to')) ? p.get('to')! : today
    let from = ok(p.get('from')) ? p.get('from')! : addDays(to, -13)
    if (from < CHECKLIST_START) from = CHECKLIST_START
    const section = (p.get('section') ?? '').trim()
    const person = (p.get('person') ?? '').trim().toLowerCase()
    const q = (p.get('q') ?? '').trim().toLowerCase()
    const issues = p.get('issues') === '1'

    const events = await sql`
      SELECT e.id, e.day, e.recorded_at, e.recorded_by, e.value, e.note, e.extra,
             t.id AS tile_id, t.title, t.icon, t.section, t.kind
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day >= ${from} AND e.day <= ${to}
        AND (${section} = '' OR t.section = ${section})
        AND (${person} = '' OR LOWER(e.recorded_by) = ${person})
        AND (${q} = '' OR LOWER(t.title) LIKE ${'%' + q + '%'} OR LOWER(COALESCE(e.note, '')) LIKE ${'%' + q + '%'})
        AND (NOT ${issues} OR e.extra->>'answer' = 'issue' OR e.extra::text LIKE '%"not"%' OR e.value = 'Not done')
      ORDER BY e.day DESC, e.recorded_at DESC LIMIT 400`
    const summary = await sql`
      SELECT t.id AS tile_id, t.title, t.icon, t.section, t.kind, COUNT(*) FILTER (WHERE e.value = 'Done')::int AS times_done,
             MAX(e.day) FILTER (WHERE e.value = 'Done') AS last_done,
             (ARRAY_AGG(e.recorded_by ORDER BY e.recorded_at DESC) FILTER (WHERE e.value = 'Done'))[1] AS last_by
      FROM daily_check_tiles t LEFT JOIN daily_check_events e ON e.tile_id = t.id AND e.day >= ${from} AND e.day <= ${to}
      WHERE (${section} = '' OR t.section = ${section}) AND (${q} = '' OR LOWER(t.title) LIKE ${'%' + q + '%'})
      GROUP BY t.id ORDER BY t.section, t.position, t.id`
    const sections = await sql`SELECT DISTINCT section FROM daily_check_tiles ORDER BY section`
    const people = await sql`SELECT DISTINCT recorded_by FROM daily_check_events ORDER BY recorded_by`
    return success({ from, to, events, summary, sections: (sections as { section: string }[]).map(s => s.section), people: (people as { recorded_by: string }[]).map(s => s.recorded_by) })
  } catch (e) { return handleError('daily-checks history', e) }
}
