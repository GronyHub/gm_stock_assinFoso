import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Finds items where selling_rate, purchase_rate, or cf_group is missing
// despite the item having real sales/bill transaction history -- a
// suspicious pattern (an actively-traded item that was never priced is
// unusual) worth a human look, not proof of the PUT bug specifically.
export async function GET() {
  const suspects = await sql`
    WITH sales_stats AS (
      SELECT item_id, COUNT(*)::int AS line_count, MAX(sr.receipt_date) AS last_sale,
             MODE() WITHIN GROUP (ORDER BY srl.item_price) AS common_price
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id IS NOT NULL AND srl.item_price IS NOT NULL AND srl.item_price > 0
      GROUP BY item_id
    ),
    bill_stats AS (
      SELECT item_id, COUNT(*)::int AS line_count, MAX(b.bill_date) AS last_bill,
             MODE() WITHIN GROUP (ORDER BY bl.unit_price) AS common_unit_price
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id IS NOT NULL AND bl.unit_price IS NOT NULL AND bl.unit_price > 0
      GROUP BY item_id
    )
    SELECT i.id, i.canonical_name, i.cf_group, i.selling_rate, i.purchase_rate, i.product_type, i.status,
           ss.line_count AS sales_line_count, ss.last_sale, ss.common_price AS common_sale_price,
           bs.line_count AS bill_line_count, bs.last_bill, bs.common_unit_price AS common_bill_price
    FROM items i
    LEFT JOIN sales_stats ss ON ss.item_id = i.id
    LEFT JOIN bill_stats bs ON bs.item_id = i.id
    WHERE COALESCE(i.product_type, 'goods') <> 'service'
      AND LOWER(COALESCE(i.status, 'active')) = 'active'
      AND (
        (i.selling_rate IS NULL OR i.selling_rate = 0) OR
        (i.purchase_rate IS NULL OR i.purchase_rate = 0) OR
        i.cf_group IS NULL
      )
      AND (COALESCE(ss.line_count, 0) > 0 OR COALESCE(bs.line_count, 0) > 0)
    ORDER BY (COALESCE(ss.line_count, 0) + COALESCE(bs.line_count, 0)) DESC
  `

  return NextResponse.json({ count: suspects.length, suspects })
}
