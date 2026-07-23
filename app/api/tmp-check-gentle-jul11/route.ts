import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const bills = await sql`
    SELECT b.id, b.bill_number, b.vendor_name, b.total, bl.raw_item_name, bl.item_id, bl.item_total
    FROM bills b
    JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.bill_date::date = '2025-07-11'
    ORDER BY b.id
  `
  return NextResponse.json({ count: bills.length, bills })
}
