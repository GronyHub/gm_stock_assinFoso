import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-08-19'
    ORDER BY bl.id
  `
  return NextResponse.json({ count: rows.length, rows })
}
