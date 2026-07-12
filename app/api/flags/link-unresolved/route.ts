import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Links every sales_receipt_line whose name matches an item by text but has
// item_id = null (see the "unlinkedNamed" flag in /api/flags) to that item.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { item_name, item_id } = await req.json()
  if (!item_name || !item_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  const linked = await sql`
    UPDATE sales_receipt_lines
    SET item_id = ${item_id}
    WHERE item_id IS NULL
      AND LOWER(COALESCE(resolved_name, raw_item_name)) = LOWER(${item_name})
    RETURNING id
  `

  await logActivity(actor, 'linked unresolved sales lines to item', `${linked.length} line${linked.length !== 1 ? 's' : ''} → ${item_name}`)
  return NextResponse.json({ ok: true, linked: linked.length })
}
