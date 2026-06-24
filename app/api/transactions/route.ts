import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    const rows = await sql`
      SELECT type, id, date::text, description, total, ref, by, item_count
      FROM (
        SELECT
          'bill'         AS type,
          id,
          bill_date      AS date,
          vendor_name    AS description,
          total,
          bill_number    AS ref,
          entered_by     AS by,
          (SELECT COUNT(*) FROM bill_lines WHERE bill_id = bills.id) AS item_count
        FROM bills

        UNION ALL

        SELECT
          'sale'         AS type,
          id,
          receipt_date   AS date,
          customer_name  AS description,
          total,
          receipt_number AS ref,
          entered_by     AS by,
          (SELECT COUNT(*) FROM sales_receipt_lines WHERE receipt_id = sales_receipts.id) AS item_count
        FROM sales_receipts

        UNION ALL

        SELECT
          'count'                         AS type,
          MIN(id)                         AS id,
          count_date                      AS date,
          COALESCE(counted_by, 'Unknown') AS description,
          NULL                            AS total,
          NULL                            AS ref,
          counted_by                      AS by,
          COUNT(*)                        AS item_count
        FROM stock_counts
        GROUP BY count_date, counted_by
      ) t
      ORDER BY date DESC, id DESC
      LIMIT 400
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('transactions GET error:', e)
    return NextResponse.json([])
  }
}
