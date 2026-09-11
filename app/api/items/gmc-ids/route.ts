import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { getCached } from '@/lib/cacheStore'

// Item IDs with at least one GMC (Grony Multimedia as Customer) sale line on
// record, plus how many GMC sale lines each has -- the same derived
// definition gmc-weekly's count list uses (app/api/stock/gmc-weekly/
// route.ts). There's no dedicated "GMC item" flag anywhere; an item only
// shows up here once it's actually been taken for internal use at least
// once. The count exists so item/page.tsx's GMC mode can rank items by how
// often they've been GMC'd before, without limiting the pickable list to
// only these items (see its own liveFilteredSortedItems memo).
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  // Fetched once on every Item hub page load. An item only ever joins this
  // list once, the first time it's ever GMC'd -- a short cache means a
  // brand-new GMC item might take a few minutes to show up here, which is
  // harmless (every other GMC feature still works from the live data).
  const rows = await getCached('items:gmc-ids', 1800, async () => {
    return await sql`
      SELECT srl.item_id, COUNT(*) AS count
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE sr.customer_name = 'Grony Multimedia as Customer' AND srl.item_id IS NOT NULL
      GROUP BY srl.item_id
    `
  })
  return NextResponse.json(rows.map(r => ({ item_id: r.item_id, count: Number(r.count) })))
}
