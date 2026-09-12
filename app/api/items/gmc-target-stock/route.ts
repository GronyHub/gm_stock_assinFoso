import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Current stock of every item that's a GMC conversion TARGET (something a
// pack_to_gmc item credits, or a service_using_gmc item draws down -- see
// items.converts_to_item_id). Not cached, unlike gmc-ids -- a staff member
// buying a new pack (see /api/sales/live-tap's reset block) needs this to
// read fresh right away, since the whole point is warning them before/as a
// target runs low, not a few minutes late.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT s.item_id, s.calculated_soh
    FROM item_stock_summary s
    WHERE s.item_id IN (SELECT DISTINCT converts_to_item_id FROM items WHERE converts_to_item_id IS NOT NULL)
  `
  return NextResponse.json(rows.map(r => ({ item_id: r.item_id, calculated_soh: parseFloat(r.calculated_soh) || 0 })))
}
