import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, dayKey, creditWork } from '@/lib/dailyChecks'
import { NextRequest } from 'next/server'

const HM = /^([01]\d|2[0-3]):[0-5]\d$/

// POST { tile_id, value?: 'Done' | 'Not done', done_at?, note? } -- always recorded for today, with the server's
// clock and the signed-in person's name.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.tile_id)
    const [t] = await sql`SELECT id, title, minutes FROM daily_check_tiles WHERE id = ${id} AND active`
    if (!t) return badRequest('Unknown tile.')
    const now = new Date()
    const doneAt = typeof b.done_at === 'string' && HM.test(b.done_at) && Number(b.done_at.slice(0, 2)) * 60 + Number(b.done_at.slice(3)) <= now.getUTCHours() * 60 + now.getUTCMinutes() ? b.done_at : null
    const [row] = await sql`INSERT INTO daily_check_events (tile_id, day, value, note, extra, recorded_by)
      VALUES (${id}, ${dayKey(now)}, ${b.value === 'Not done' ? 'Not done' : 'Done'}, ${b.note ? String(b.note).slice(0, 500) : null},
              ${JSON.stringify(doneAt ? { done_at: doneAt } : {})}::jsonb, ${getActorName(session)})
      RETURNING id, tile_id, day, value, note, extra, recorded_by, recorded_at`
    // A finished tile counts as work time for whoever ticked it: it is logged as an activity, and the worked time at
    // the top of the pages adds up today's activities (see /api/staff-times/worked-today). No push is sent for it.
    if (row.value === 'Done') await creditWork(getActorName(session), String(t.title), Number(t.minutes ?? 5), Number(row.id))
    return success(row, 201)
  } catch (e) { return handleError('daily-checks tap', e) }
}
