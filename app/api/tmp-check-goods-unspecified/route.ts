import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ILIKE '%Unspecified%Pre-Zoho%' OR canonical_name ILIKE '%Goods - Unspecified%'
  `
  const results = []
  for (const it of items as { id: number; canonical_name: string; status: string | null }[]) {
    const [[sales], [bills], [counts], [dependents], [aliases]] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${it.id}`,
      sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${it.id}`,
      sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${it.id}`,
      sql`SELECT COUNT(*)::int AS n FROM items WHERE converts_to_item_id = ${it.id}`,
      sql`SELECT COUNT(*)::int AS n FROM item_aliases WHERE item_id = ${it.id}`,
    ])
    results.push({ ...it, sales: sales.n, bills: bills.n, counts: counts.n, dependents: dependents.n, aliases: aliases.n })
  }
  return NextResponse.json(results)
}
