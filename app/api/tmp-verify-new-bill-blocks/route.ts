import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT b.id, b.bill_number, bl.raw_item_name, bl.quantity, bl.unit_price, bl.item_total, bl.usage_unit, bl.source
    FROM bills b JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.bill_date::date = '2025-08-02'
    ORDER BY b.id
  `
  return NextResponse.json(rows)
}
