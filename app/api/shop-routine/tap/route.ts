import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureShopRoutine } from '@/lib/shopRoutine'
import { NextRequest } from 'next/server'

const HM = /^([01]\d|2[0-3]):[0-5]\d$/

// POST { routine_id, value?: 'Done'|'Not done', minutes?, support?, done_at?, note? }
// Stamped with the server's clock and the signed-in person's name.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureShopRoutine()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.routine_id)
    const [t] = await sql`SELECT id FROM shop_routine WHERE id = ${id} AND active`
    if (!t) return badRequest('Unknown tile.')
    const value = b.value === 'Not done' ? 'Not done' : 'Done'
    const m = Math.round(Number(b.minutes))
    const now = new Date()
    const doneAt = typeof b.done_at === 'string' && HM.test(b.done_at) && Number(b.done_at.slice(0, 2)) * 60 + Number(b.done_at.slice(3)) <= now.getUTCHours() * 60 + now.getUTCMinutes() ? b.done_at : null
    const extra = { ...(m >= 1 && m <= 600 ? { minutes: m } : {}), ...(b.support === 'alone' || b.support === 'support' ? { support: b.support } : {}), ...(doneAt ? { done_at: doneAt } : {}) }
    const [row] = await sql`INSERT INTO shop_routine_events (routine_id, value, note, extra, recorded_by)
      VALUES (${id}, ${value}, ${b.note ? String(b.note).slice(0, 500) : null}, ${JSON.stringify(extra)}::jsonb, ${getActorName(session)})
      RETURNING id, routine_id, value, note, extra, recorded_by, recorded_at`
    return success(row, 201)
  } catch (e) { return handleError('shop-routine tap', e) }
}
