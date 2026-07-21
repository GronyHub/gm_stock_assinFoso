import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT
      bill_id,
      item_id,
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      unit_price,
      item_total,
      usage_unit
    FROM bill_lines
    ORDER BY bill_id, id
  `
  return NextResponse.json(rows)
}
