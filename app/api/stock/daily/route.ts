import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const DAILY_ITEM_IDS = [367, 368, 369, 370, 371, 372, 373, 374, 375, 376]

export async function GET() {
  const rows = await sql`
    SELECT
      s.item_id,
      s.item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      CASE
        WHEN c.last_count_date::date = CURRENT_DATE THEN 0
        ELSE (CURRENT_DATE - COALESCE(c.last_count_date::date, '1900-01-01'))
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN (
      SELECT item_id, MAX(count_date) AS last_count_date
      FROM stock_counts
      GROUP BY item_id
    ) c ON c.item_id = s.item_id
    WHERE s.item_id = ANY(${DAILY_ITEM_IDS})
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND (c.last_count_date IS NULL OR c.last_count_date::date < CURRENT_DATE)
    ORDER BY s.item_name ASC
  `
  return NextResponse.json(rows)
}
