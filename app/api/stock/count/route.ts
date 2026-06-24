import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId, qty, notes } = await req.json()
  if (!itemId || qty == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const item = await sql`SELECT zoho_item_id, canonical_name FROM items WHERE id = ${itemId}`
  if (!item.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const countedBy = (session.user as any)?.display_name || (session.user as any)?.username || session.user?.name || null
  await sql`
    INSERT INTO stock_counts (item_id, zoho_item_id, item_name, count_date, quantity_counted, notes, source, counted_by)
    VALUES (${itemId}, ${item[0].zoho_item_id}, ${item[0].canonical_name}, ${today}, ${qty}, ${notes || null}, 'app', ${countedBy})
    ON CONFLICT DO NOTHING
  `
  return NextResponse.json({ ok: true })
}
