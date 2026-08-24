import { requireAuth, getActorName, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const actor = getActorName(session)

  const items: { item_name: string; item_id: number }[] = Array.isArray(body.items)
    ? body.items.filter((i: any) => i.item_name && i.item_id)
    : (body.item_name && body.item_id) ? [{ item_name: body.item_name, item_id: body.item_id }] : []

  if (!items.length) return badRequest('Missing fields')

  const results = await Promise.all(items.map(({ item_name, item_id }) =>
    sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item_id}
      WHERE item_id IS NULL
        AND LOWER(COALESCE(resolved_name, raw_item_name)) = LOWER(${item_name})
      RETURNING id
    `.then(linked => ({ item_name, count: linked.length }))
  ))

  const totalLinked = results.reduce((sum, r) => sum + r.count, 0)
  const breakdown = results.filter(r => r.count > 0).map(r => `${r.item_name} (${r.count})`)

  await logActivity(actor, 'linked unresolved sales lines to item', `${totalLinked} line${totalLinked !== 1 ? 's' : ''}: ${breakdown.join(', ')}`)
  return success({ ok: true, linked: totalLinked, breakdown })
}
