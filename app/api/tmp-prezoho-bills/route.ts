import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT b.id, b.bill_number, b.bill_date, b.vendor_name, b.total, b.source,
           COUNT(bl.id) AS item_count,
           COUNT(bl.id) FILTER (WHERE bl.item_id IS NULL OR bl.unresolved) AS error_count
    FROM bills b
    LEFT JOIN bill_lines bl ON bl.bill_id = b.id
    WHERE b.source IN ('prezoho_mlaws', 'bizims_historical')
    GROUP BY b.id, b.bill_number, b.bill_date, b.vendor_name, b.total, b.source
    ORDER BY b.bill_date, b.id
  `
  return NextResponse.json({ count: rows.length, rows })
}
