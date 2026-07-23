import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const DATES = ['2025-08-02', '2025-07-11', '2025-08-05', '2025-09-20', '2025-08-19', '2025-09-13']

export async function GET() {
  const rows = await sql`
    SELECT b.bill_date::date::text AS date, bl.raw_item_name, bl.item_id, bl.resolved_name,
           bl.quantity, bl.unit_price, bl.item_total, COALESCE(bl.unresolved, false) AS unresolved
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    WHERE b.bill_date::date = ANY(${DATES})
    ORDER BY b.bill_date, bl.id
  `
  return NextResponse.json({ count: rows.length, rows })
}
