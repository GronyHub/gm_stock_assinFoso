import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const ITEM_IDS = [307, 367, 101, 342, 244, 304, 373, 306, 374, 319, 320, 340]

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, product_type, status, converts_to_item_id, units_per_pack
    FROM items WHERE id = ANY(${ITEM_IDS}) ORDER BY id
  `
  const aliasRows = await sql`
    SELECT id, item_id, alias_name, alias_type, source FROM item_aliases
    WHERE item_id = ANY(${ITEM_IDS}) ORDER BY item_id, id
  `
  const activity = []
  for (const id of ITEM_IDS) {
    const [[sales], [bills]] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${id}`,
    ])
    activity.push({ id, sales: sales.n, bills: bills.n })
  }
  return NextResponse.json({ items, aliasRows, activity })
}
