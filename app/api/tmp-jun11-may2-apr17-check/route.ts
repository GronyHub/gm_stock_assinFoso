import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const dates = ['2025-06-11', '2025-05-02', '2025-04-17']
  const result: Record<string, unknown> = {}
  for (const d of dates) {
    const lines = await sql`
      SELECT bl.id, bl.bill_id, bl.raw_item_name, bl.resolved_name, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.bill_number, b.total AS bill_total, b.vendor_name
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      WHERE b.bill_date::date = ${d}
      ORDER BY bl.id
    `
    const bills = await sql`
      SELECT id, bill_number, total, vendor_name FROM bills WHERE bill_date::date = ${d} ORDER BY id
    `
    result[d] = { lineCount: lines.length, lines, billCount: bills.length, bills }
  }
  const candidateItems = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ILIKE '%paper cutter%' OR canonical_name ILIKE '%glue%'
  `
  return NextResponse.json({ ...result, candidateItems })
}
