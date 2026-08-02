import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const pvc = await sql`
    SELECT id, canonical_name, cf_group, status FROM items
    WHERE canonical_name ILIKE '%PVC%' ORDER BY canonical_name
  `
  const invitation = await sql`
    SELECT id, canonical_name, cf_group, status, product_type FROM items
    WHERE canonical_name ILIKE '%invitation%' OR canonical_name ILIKE '%inv. cards%' OR canonical_name ILIKE '%inv cards%'
    ORDER BY canonical_name
  `
  const toner26a = await sql`
    SELECT id, canonical_name, cf_group, status FROM items
    WHERE canonical_name ILIKE '%26A%' ORDER BY canonical_name
  `

  const mergeIds = [117, 121, 205, 379, 282, 273, 87]
  const details = await sql`
    SELECT i.id, i.canonical_name, i.status, i.product_type,
      (SELECT COUNT(*)::int FROM sales_receipt_lines WHERE item_id = i.id) AS sales,
      (SELECT COUNT(*)::int FROM bill_lines WHERE item_id = i.id) AS bills,
      (SELECT COUNT(*)::int FROM stock_counts WHERE item_id = i.id) AS counts,
      (SELECT COUNT(*)::int FROM item_aliases WHERE item_id = i.id) AS aliases,
      s.calculated_soh
    FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.id = ANY(${mergeIds})
  `

  return NextResponse.json({ pvc, invitation, toner26a, details })
}
