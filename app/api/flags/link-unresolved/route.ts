import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Links every sales_receipt_line whose name matches an item by text but has
// item_id = null (see the "unlinkedNamed" flag in /api/flags) to that item.
// Accepts either a single { item_name, item_id } or a bulk { items: [...] }.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  const items: { item_name: string; item_id: number }[] = Array.isArray(body.items)
    ? body.items.filter((i: any) => i.item_name && i.item_id)
    : (body.item_name && body.item_id) ? [{ item_name: body.item_name, item_id: body.item_id }] : []

  if (!items.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  let totalLinked = 0
  for (const { item_name, item_id } of items) {
    const linked = await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item_id}
      WHERE item_id IS NULL
        AND LOWER(COALESCE(resolved_name, raw_item_name)) = LOWER(${item_name})
      RETURNING id
    `
    totalLinked += linked.length
  }

  await logActivity(actor, 'linked unresolved sales lines to item', `${totalLinked} line${totalLinked !== 1 ? 's' : ''} across ${items.length} item name${items.length !== 1 ? 's' : ''}`)
  return NextResponse.json({ ok: true, linked: totalLinked })
}
