import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Any Inactive item that still has bill/sales lines pointing at it is a
// candidate for the same bug that hit A4 SHEETS DOUBLE A: /api/items/search
// (used by the PO/Bill entry pickers) didn't filter out Inactive items, so a
// merged-away duplicate could still be picked and silently re-accumulate
// stock activity after being merged.
export async function GET() {
  const rows = await sql`
    SELECT i.id, i.canonical_name, i.status, i.cf_group,
      (SELECT COUNT(*)::int FROM bill_lines WHERE item_id = i.id) AS bill_line_count,
      (SELECT MAX(b.bill_date)::text FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id WHERE bl.item_id = i.id) AS last_bill_date,
      (SELECT COUNT(*)::int FROM sales_receipt_lines WHERE item_id = i.id) AS sales_line_count,
      (SELECT MAX(sr.receipt_date)::text FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id WHERE srl.item_id = i.id) AS last_sale_date
    FROM items i
    WHERE LOWER(i.status) = 'inactive'
    ORDER BY i.canonical_name
  `
  const withActivity = rows.filter((r: any) => r.bill_line_count > 0 || r.sales_line_count > 0)

  const mergeLog = await sql`
    SELECT id, staff_name, action, details, created_at FROM activity_logs
    WHERE action = 'merged items' ORDER BY created_at
  `

  return NextResponse.json({ inactiveItemsWithActivity: withActivity, totalInactive: rows.length, mergeLog })
}
