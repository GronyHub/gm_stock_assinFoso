import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, dayKey, creditWork, removeCredit } from '@/lib/dailyChecks'
import { NextRequest } from 'next/server'

const HM = /^([01]\d|2[0-3]):[0-5]\d$/
type Ctx = { params: Promise<{ id: string }> }

// PATCH { value?, note?, done_at? } -- change today's record. DELETE -- put the tile back to waiting.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const [e] = await sql`SELECT id, day, extra, tile_id, value FROM daily_check_events WHERE id = ${id}`
    if (!e) return badRequest('Record not found.')
    if (e.day !== dayKey()) return badRequest('Only today\'s records can be changed.')
    const extra = { ...((e.extra as object) ?? {}), ...(typeof b.done_at === 'string' ? (HM.test(b.done_at) ? { done_at: b.done_at } : {}) : {}) }
    if (b.done_at === null || b.done_at === '') delete (extra as { done_at?: string }).done_at
    const value = b.value === 'Done' || b.value === 'Not done' ? b.value : null
    await sql`UPDATE daily_check_events SET value = COALESCE(${value}, value), note = ${b.note ? String(b.note).slice(0, 500) : null}, extra = ${JSON.stringify(extra)}::jsonb WHERE id = ${id}`
    if (value && value !== e.value) {
      if (value === 'Not done') await removeCredit(id)
      else {
        const [t] = await sql`SELECT title, minutes FROM daily_check_tiles WHERE id = ${e.tile_id}`
        if (t) await creditWork(getActorName(session), String(t.title), Number(t.minutes ?? 5), id)
      }
    }
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks event PATCH', e) }
}
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const id = Number((await params).id)
    const [e] = await sql`SELECT day FROM daily_check_events WHERE id = ${id}`
    if (e && e.day !== dayKey()) return badRequest('Only today\'s records can be removed.')
    await sql`DELETE FROM daily_check_events WHERE id = ${id}`
    await removeCredit(id)
    return success({ ok: true })
  } catch (e) { return handleError('daily-checks event DELETE', e) }
}
