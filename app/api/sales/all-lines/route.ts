import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT
      receipt_id,
      item_id,
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      item_price,
      item_total,
      usage_unit
    FROM sales_receipt_lines
    ORDER BY receipt_id, id
  `
  return NextResponse.json(rows)
}
