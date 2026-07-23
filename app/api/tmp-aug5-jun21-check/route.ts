import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const aug5 = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.bill_number, b.total AS bill_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-08-05'
    ORDER BY bl.id
  `
  const aug5Bills = await sql`
    SELECT id, bill_number, total, vendor_name FROM bills WHERE bill_date::date = '2025-08-05' ORDER BY id
  `
  const jun21 = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.bill_number, b.total AS bill_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-06-21'
    ORDER BY bl.id
  `
  const jun21Bills = await sql`
    SELECT id, bill_number, total, vendor_name FROM bills WHERE bill_date::date = '2025-06-21' ORDER BY id
  `
  return NextResponse.json({
    aug5: { lineCount: aug5.length, lines: aug5, billCount: aug5Bills.length, bills: aug5Bills },
    jun21: { lineCount: jun21.length, lines: jun21, billCount: jun21Bills.length, bills: jun21Bills },
  })
}
