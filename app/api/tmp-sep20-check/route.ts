import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const appcomVendors = await sql`
    SELECT DISTINCT vendor_name FROM bills WHERE vendor_name ILIKE '%appcom%'
  `
  const item85 = await sql`
    SELECT id, canonical_name, status FROM items WHERE canonical_name ILIKE '%85A%'
  `
  const item112 = await sql`SELECT id, canonical_name FROM items WHERE id = 112`
  const sep20Lines = await sql`
    SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.vendor_name
    FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = '2025-09-20'
    ORDER BY bl.id
  `
  return NextResponse.json({ appcomVendors, item85, item112, sep20Lines })
}
