import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const IDS = [200, 177, 262, 82, 295, 81, 260]

export async function GET() {
  const rows = await sql`
    SELECT
      i.id, i.canonical_name, i.status,
      (SELECT COUNT(*) FROM sales_receipt_lines srl WHERE srl.item_id = i.id) AS sales_lines,
      (SELECT MAX(sr.receipt_date)::date::text FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id WHERE srl.item_id = i.id) AS last_sale,
      (SELECT COUNT(*) FROM bill_lines bl WHERE bl.item_id = i.id) AS bill_lines,
      (SELECT MAX(b.bill_date)::date::text FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id WHERE bl.item_id = i.id) AS last_bill,
      (SELECT COUNT(*) FROM stock_counts sc WHERE sc.item_id = i.id) AS counts,
      (SELECT MAX(sc.count_date)::date::text FROM stock_counts sc WHERE sc.item_id = i.id) AS last_count,
      (SELECT COUNT(*) FROM item_aliases ia WHERE ia.item_id = i.id) AS aliases
    FROM items i
    WHERE i.id = ANY(${IDS})
    ORDER BY i.canonical_name, i.id
  `
  return NextResponse.json(rows)
}
