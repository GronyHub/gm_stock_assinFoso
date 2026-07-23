import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const nullQty = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.quantity, bl.item_id, b.bill_date, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE bl.quantity IS NULL
    ORDER BY b.bill_date DESC
    LIMIT 30
  `
  const nullQtyCount = await sql`SELECT COUNT(*) FROM bill_lines WHERE quantity IS NULL`
  const nullVendorCount = await sql`SELECT COUNT(*) FROM bills WHERE vendor_name IS NULL`
  const totalLines = await sql`SELECT COUNT(*) FROM bill_lines`
  return NextResponse.json({
    nullQtySample: nullQty,
    nullQtyCount: nullQtyCount[0],
    nullVendorBillsCount: nullVendorCount[0],
    totalLines: totalLines[0],
  })
}
