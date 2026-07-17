import sql from '@/lib/db'
import { DAILY_ITEM_IDS } from '@/lib/countRules'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT
      s.item_id,
      COALESCE(i.canonical_name, s.item_name) AS item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      CASE
        WHEN c.last_count_date::date = CURRENT_DATE THEN 0
        ELSE (CURRENT_DATE - COALESCE(c.last_count_date::date, '1900-01-01'))
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN (
      SELECT item_id, MAX(count_date) AS last_count_date
      FROM stock_counts
      GROUP BY item_id
    ) c ON c.item_id = s.item_id
    WHERE s.item_id = ANY(${DAILY_ITEM_IDS})
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND (c.last_count_date IS NULL OR c.last_count_date::date < CURRENT_DATE)
    ORDER BY COALESCE(i.canonical_name, s.item_name) ASC
  `
  return NextResponse.json(rows)
}
