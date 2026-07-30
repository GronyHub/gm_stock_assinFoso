import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const item = await sql`
    SELECT id, canonical_name, opening_stock, opening_stock_value, stock_on_hand, track_inventory
    FROM items WHERE canonical_name ILIKE '%4x6%photo%' OR canonical_name ILIKE '%4x6%'
  `
  const viewDef = await sql`SELECT pg_get_viewdef('item_stock_summary', true) AS def`
  const counts = item.length
    ? await sql`SELECT id, count_date, quantity, notes, source, created_at FROM stock_counts WHERE item_id = ${item[0].id} ORDER BY count_date DESC, id DESC LIMIT 20`
    : []
  const summary = item.length
    ? await sql`SELECT * FROM item_stock_summary WHERE item_id = ${item[0].id}`
    : []
  return NextResponse.json({ item, viewDef: viewDef[0]?.def, counts, summary })
}
