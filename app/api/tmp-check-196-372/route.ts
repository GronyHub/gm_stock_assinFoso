import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, status, selling_rate, purchase_rate, cf_group, product_type
    FROM items WHERE id IN (196, 372)
  `

  const tables = ['sales_receipt_lines', 'bill_lines', 'invoice_lines', 'stock_counts', 'closer_counts',
    'inventory_adjustment_lines', 'purchase_order_lines', 'live_sale_taps', 'item_transaction_history',
    'stock_count_revisions', 'item_stock_summary']

  const refCounts: Record<number, Record<string, number>> = { 196: {}, 372: {} }
  for (const t of tables) {
    try {
      const rows = await sql`
        SELECT item_id, COUNT(*)::int AS cnt FROM ${sql.unsafe(t)}
        WHERE item_id IN (196, 372) GROUP BY item_id
      ` as { item_id: number; cnt: number }[]
      for (const r of rows) refCounts[r.item_id][t] = r.cnt
    } catch { /* skip */ }
  }

  const aliasesFor196 = await sql`SELECT id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 196`
  const aliasesFor372 = await sql`SELECT id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 372`

  return NextResponse.json({ items, refCounts, aliasesFor196, aliasesFor372 })
}
