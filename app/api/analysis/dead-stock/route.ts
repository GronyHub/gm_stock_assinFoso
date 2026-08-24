import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      WITH last_movement AS (
        SELECT item_id, MAX(receipt_date) AS last_date
        FROM sales_receipt_lines
        WHERE item_id IS NOT NULL
        GROUP BY item_id
        UNION ALL
        SELECT item_id, MAX(bill_date)
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE item_id IS NOT NULL
        GROUP BY item_id
      )
      SELECT
        i.id, i.canonical_name,
        MAX(lm.last_date)::date AS last_movement,
        (CURRENT_DATE - MAX(lm.last_date)::date)::int AS days_since
      FROM items i
      LEFT JOIN last_movement lm ON lm.item_id = i.id
      WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
        AND i.product_type <> 'service'
      GROUP BY i.id, i.canonical_name
      HAVING (CURRENT_DATE - MAX(lm.last_date)::date) > 90 OR MAX(lm.last_date) IS NULL
      ORDER BY days_since DESC NULLS LAST
    `
    return success(rows)
  } catch (e) {
    return handleError('analysis/dead-stock', e)
  }
}
