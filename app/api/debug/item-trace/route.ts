import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Temporary read-only diagnostic: traces a name pattern across ALL items
// (including Inactive ones, which the normal item list hides) and shows
// exactly which item_id each matching sales_receipt_line resolved to on a
// given date. Used to track down cases where a receipt shows an item's
// name/amount but that activity doesn't appear on the item itself --
// usually because the receipt line's item_id points to a different
// (often orphaned/inactive) item row than the one being viewed.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name')
  const date = searchParams.get('date')
  if (!name) return NextResponse.json({ error: 'name query param required' }, { status: 400 })

  const matchingItems = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name ILIKE ${'%' + name + '%'}
    ORDER BY canonical_name
  `

  const receiptLines = await sql`
    SELECT sr.id AS receipt_id, sr.receipt_number, sr.receipt_date::text AS receipt_date,
           sr.customer_name, srl.raw_item_name, srl.resolved_name, srl.item_id,
           i.canonical_name AS item_canonical_name, i.status AS item_status,
           srl.quantity, srl.item_price
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE (srl.raw_item_name ILIKE ${'%' + name + '%'} OR srl.resolved_name ILIKE ${'%' + name + '%'})
      AND (${date ?? null}::date IS NULL OR sr.receipt_date::date = ${date ?? null}::date)
    ORDER BY sr.receipt_date DESC
    LIMIT 100
  `

  return NextResponse.json({ matchingItems, receiptLines })
}
