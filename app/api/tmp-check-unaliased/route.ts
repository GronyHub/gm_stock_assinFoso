import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sales = await sql`
    SELECT s.raw_item_name, COUNT(*)::int AS line_count,
           COUNT(*) FILTER (WHERE s.item_id IS NOT NULL)::int AS resolved_count
    FROM sales_receipt_lines s
    WHERE NOT EXISTS (
      SELECT 1 FROM item_aliases a WHERE LOWER(TRIM(a.alias_name)) = LOWER(TRIM(s.raw_item_name))
    )
    GROUP BY s.raw_item_name
    ORDER BY line_count DESC
  `
  const bills = await sql`
    SELECT b.raw_item_name, COUNT(*)::int AS line_count,
           COUNT(*) FILTER (WHERE b.item_id IS NOT NULL)::int AS resolved_count
    FROM bill_lines b
    WHERE NOT EXISTS (
      SELECT 1 FROM item_aliases a WHERE LOWER(TRIM(a.alias_name)) = LOWER(TRIM(b.raw_item_name))
    )
    GROUP BY b.raw_item_name
    ORDER BY line_count DESC
  `
  return NextResponse.json({ sales, bills })
}
