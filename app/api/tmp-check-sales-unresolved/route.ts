import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt,
           MIN(sr.receipt_date)::date::text AS earliest, MAX(sr.receipt_date)::date::text AS latest
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    WHERE srl.item_id IS NULL OR srl.unresolved = true
    GROUP BY raw_item_name
    ORDER BY cnt DESC
  `
  return NextResponse.json({ count: rows.length, rows })
}
