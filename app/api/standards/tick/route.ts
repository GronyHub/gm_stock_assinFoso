import { requireAuth, badRequest, notFound, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureStandardsTables, periodKeyFor } from '@/lib/standards'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureStandardsTables()
    const { itemId, ticked } = await req.json() as { itemId?: number; ticked?: boolean }
    if (!Number.isInteger(itemId)) return badRequest('itemId is required.')
    const [item] = await sql`SELECT id, frequency FROM standards_items WHERE id = ${itemId as number} AND active`
    if (!item) return notFound()
    const key = periodKeyFor(item.frequency)
    if (ticked) {
      await sql`
        INSERT INTO standards_ticks (item_id, period_key, ticked_by)
        VALUES (${item.id}, ${key}, ${getActorName(session)})
        ON CONFLICT (item_id, period_key) DO NOTHING`
    } else {
      await sql`DELETE FROM standards_ticks WHERE item_id = ${item.id} AND period_key = ${key}`
    }
    return success({ ok: true })
  } catch (e) {
    return handleError('standards tick', e)
  }
}
