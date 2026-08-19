import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Item IDs with at least one GMC (Grony Multimedia as Customer) sale line on
// record -- the same derived definition gmc-weekly's count list uses
// (app/api/stock/gmc-weekly/route.ts). There's no dedicated "GMC item" flag
// anywhere; an item only shows up here once it's actually been taken for
// internal use at least once.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const rows = await sql`
    SELECT DISTINCT srl.item_id
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    WHERE sr.customer_name = 'Grony Multimedia as Customer' AND srl.item_id IS NOT NULL
  `
  return NextResponse.json(rows.map(r => r.item_id))
}
