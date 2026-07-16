import sql from '@/lib/db'
import { DAILY_ITEM_IDS } from '@/lib/countRules'
import { NextResponse } from 'next/server'

// 7-day count list: GMC items -- goods the shop takes for its own use
// (4x6 packs, A4 sheets, Brown Envelope packs, etc., identified by having
// at least one GMC take on record). Internal use moves faster and is easier
// to forget to record, so these get a weekly count instead of 15 days.
// Daily-count items are excluded (they're already counted every day), and
// services are never countable.
export async function GET() {
  const rows = await sql`
    WITH gmc_items AS (
      SELECT DISTINCT srl.item_id
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE sr.customer_name = 'Grony Multimedia as Customer' AND srl.item_id IS NOT NULL
    ),
    lastc AS (
      SELECT item_id, MAX(count_date) AS last_count_date
      FROM stock_counts GROUP BY item_id
    )
    SELECT
      s.item_id,
      s.item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      CASE
        WHEN c.last_count_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - c.last_count_date::date - 7)
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN lastc c ON c.item_id = s.item_id
    WHERE s.item_id IN (SELECT item_id FROM gmc_items)
      AND s.item_id <> ALL(${DAILY_ITEM_IDS})
      AND s.item_name NOT ILIKE 'old stop%'
      AND s.item_name NOT ILIKE 'old- stop%'
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND (s.cf_group IS NULL OR s.cf_group NOT ILIKE 'service%')
      AND (c.last_count_date IS NULL
       OR c.last_count_date::date < CURRENT_DATE - 7)
    ORDER BY
      CASE WHEN c.last_count_date IS NULL THEN 999999
           ELSE (CURRENT_DATE - c.last_count_date::date)
      END DESC,
      s.item_name ASC
  `
  return NextResponse.json(rows)
}
