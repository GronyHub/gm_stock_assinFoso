import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const IDS = [381, 388, 378]

export async function GET() {
  const out: Record<string, unknown> = {}
  for (const id of IDS) {
    const [item] = await sql`SELECT id, canonical_name, status FROM items WHERE id = ${id}`
    const [[sales], [bills], [counts], [dependents], [aliases]] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM items WHERE converts_to_item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM item_aliases WHERE item_id = ${id}`,
    ])
    out[id] = { item, sales: sales.n, bills: bills.n, counts: counts.n, dependents: dependents.n, aliases: aliases.n }
  }
  return NextResponse.json(out)
}

export async function POST() {
  const results: Record<string, unknown> = {}
  for (const id of IDS) {
    const [item] = await sql`SELECT id, canonical_name FROM items WHERE id = ${id}`
    if (!item) { results[id] = { error: 'not found' }; continue }

    const [[sales], [bills], [counts], [dependents]] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n FROM items WHERE converts_to_item_id = ${id}`,
    ])
    if (sales.n > 0 || bills.n > 0 || counts.n > 0 || dependents.n > 0) {
      results[id] = { error: 'has history, not deleted', sales: sales.n, bills: bills.n, counts: counts.n, dependents: dependents.n }
      continue
    }

    await sql`DELETE FROM item_aliases WHERE item_id = ${id}`
    await sql`DELETE FROM dismissed_duplicates WHERE item_id1 = ${id} OR item_id2 = ${id}`
    await sql`DELETE FROM items WHERE id = ${id}`
    results[id] = { deleted: item.canonical_name }
  }
  return NextResponse.json(results)
}
