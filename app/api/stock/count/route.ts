import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { itemId, qty, notes } = await req.json()
  if (!itemId || qty == null) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const today = new Date().toISOString().slice(0, 10)
  const item = await sql`SELECT zoho_item_id, canonical_name FROM items WHERE id = ${itemId}`
  if (!item.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // session.user.name = display_name (set in auth authorize callback)
  // session.user.username = raw login name (set in jwt/session callbacks)
  const countedBy = session.user?.name || (session.user as any)?.username || null

  // One count per item per day: the loss math SUMS counts per date, so a
  // second same-day count (e.g. a manual recount after the daily count)
  // would double the counted quantity. Replace today's count instead.
  const [existing] = await sql`
    SELECT id FROM stock_counts
    WHERE item_id = ${itemId} AND count_date::date = ${today}
    ORDER BY id DESC LIMIT 1
  `
  if (existing) {
    await sql`
      UPDATE stock_counts
      SET quantity_counted = ${qty}, notes = ${notes || null}, source = 'app', counted_by = ${countedBy}
      WHERE id = ${existing.id}
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty} (replaced today's earlier count)`)
  } else {
    await sql`
      INSERT INTO stock_counts (item_id, zoho_item_id, item_name, count_date, quantity_counted, notes, source, counted_by)
      VALUES (${itemId}, ${item[0].zoho_item_id}, ${item[0].canonical_name}, ${today}, ${qty}, ${notes || null}, 'app', ${countedBy})
    `
    await logActivity(countedBy ?? 'Unknown', 'counted stock', `${item[0].canonical_name} · qty ${qty}`)
  }
  return NextResponse.json({ ok: true })
}
