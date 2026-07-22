import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const schemaInfo = await sql`
    SELECT table_name, table_type FROM information_schema.tables
    WHERE table_name = 'item_stock_summary'
  `

  const summary = await sql`SELECT * FROM item_stock_summary WHERE item_id = 1`

  const recentSales = await sql`
    SELECT srl.item_price, srl.quantity, sr.receipt_date, srl.raw_item_name, srl.resolved_name
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    WHERE srl.item_id = 1
    ORDER BY sr.receipt_date DESC
    LIMIT 10
  `

  const recentBills = await sql`
    SELECT bl.unit_price, bl.quantity, bl.item_total, b.bill_date, bl.raw_item_name, bl.resolved_name
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE bl.item_id = 1
    ORDER BY b.bill_date DESC
    LIMIT 10
  `

  const aliases = await sql`SELECT alias_name, alias_type, source FROM item_aliases WHERE item_id = 1`

  const stockCounts = await sql`
    SELECT count_date, quantity_counted, notes FROM stock_counts WHERE item_id = 1 ORDER BY count_date DESC LIMIT 5
  `

  const similarItems = await sql`
    SELECT id, canonical_name, cf_group, selling_rate, purchase_rate, unit_name
    FROM items
    WHERE canonical_name ILIKE '%tape%' AND id <> 1
    ORDER BY canonical_name
  `

  return NextResponse.json({ schemaInfo, summary, recentSales, recentBills, aliases, stockCounts, similarItems })
}
