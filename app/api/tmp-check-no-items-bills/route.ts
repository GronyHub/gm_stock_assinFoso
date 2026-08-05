import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  // Bills with a real total but NO bill_lines resolving to a real item --
  // either zero lines at all, or line(s) that exist but were never linked.
  const rows = await sql`
    SELECT b.id, b.bill_number, b.vendor_name, b.bill_date::date AS bill_date, b.total,
      (SELECT COUNT(*)::int FROM bill_lines WHERE bill_id = b.id) AS line_count,
      (SELECT COUNT(*)::int FROM bill_lines WHERE bill_id = b.id AND item_id IS NOT NULL) AS resolved_line_count
    FROM bills b
    WHERE COALESCE(b.total, 0) > 0
      AND NOT EXISTS (SELECT 1 FROM bill_lines bl WHERE bl.bill_id = b.id AND bl.item_id IS NOT NULL)
    ORDER BY b.bill_date DESC
  `
  return NextResponse.json({ count: rows.length, rows })
}
