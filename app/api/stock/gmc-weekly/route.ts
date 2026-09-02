import sql from '@/lib/db'
import { DAILY_ITEM_IDS, ensureCountCadenceColumns } from '@/lib/countRules'
import { NextResponse } from 'next/server'

let cachedGmcWeekly: any = null
let cachedGmcWeeklyTime = 0
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

// 7-day count list: GMC items -- goods the shop takes for its own use
// (4x6 packs, A4 sheets, Brown Envelope packs, etc., identified by having
// at least one GMC take on record). Internal use moves faster and is easier
// to forget to record, so these get a weekly count instead of 15 days --
// unless an item's own edit form set a different cadence (items.
// count_cadence_days), which wins over the 7-day default when present.
// Daily-count items are excluded (they're already counted every day),
// services are never countable, and count_excluded opts an item out
// entirely regardless of its GMC history. Same dormant rule as
// /api/stock/overdue: last 2+ counts all zero with no bill since drops the
// item off this list too, until a bill brings it back.
export async function GET() {
  const now = Date.now()
  if (cachedGmcWeekly && now - cachedGmcWeeklyTime < CACHE_TTL) {
    return NextResponse.json(cachedGmcWeekly)
  }

  await ensureCountCadenceColumns()
  const rows = await sql`
    WITH gmc_items AS (
      SELECT DISTINCT srl.item_id
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE sr.customer_name = 'Grony Multimedia as Customer' AND srl.item_id IS NOT NULL
    ),
    ranked AS (
      SELECT item_id, count_date::date AS d, quantity_counted,
             ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY count_date DESC, id DESC) AS rn
      FROM stock_counts
    ),
    recent AS (
      SELECT item_id,
             COUNT(*) FILTER (WHERE rn <= 2) AS n2,
             BOOL_AND(quantity_counted = 0) FILTER (WHERE rn <= 2) AS zeros2,
             MIN(d) FILTER (WHERE rn <= 2) AS since2
      FROM ranked WHERE rn <= 2
      GROUP BY item_id
    ),
    last_bill AS (
      SELECT bl.item_id, MAX(b.bill_date::date) AS d
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      GROUP BY bl.item_id
    ),
    lastc AS (
      SELECT item_id, MAX(count_date) AS last_count_date
      FROM stock_counts GROUP BY item_id
    )
    SELECT
      s.item_id,
      COALESCE(i.canonical_name, s.item_name) AS item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      CASE
        WHEN c.last_count_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - c.last_count_date::date - COALESCE(i.count_cadence_days, 7))
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN lastc c ON c.item_id = s.item_id
    LEFT JOIN recent r ON r.item_id = s.item_id
    LEFT JOIN last_bill lb ON lb.item_id = s.item_id
    WHERE s.item_id IN (SELECT item_id FROM gmc_items)
      AND s.item_id <> ALL(${DAILY_ITEM_IDS})
      AND s.item_name NOT ILIKE 'old stop%'
      AND s.item_name NOT ILIKE 'old- stop%'
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND (s.cf_group IS NULL OR s.cf_group NOT ILIKE 'service%')
      AND COALESCE(i.count_excluded, false) = false
      AND NOT (COALESCE(r.n2, 0) >= 2 AND COALESCE(r.zeros2, false) AND (lb.d IS NULL OR lb.d <= r.since2))
      AND (c.last_count_date IS NULL
       OR c.last_count_date::date <= CURRENT_DATE - COALESCE(i.count_cadence_days, 7))
    ORDER BY
      CASE WHEN c.last_count_date IS NULL THEN 999999
           ELSE (CURRENT_DATE - c.last_count_date::date)
      END DESC,
      COALESCE(i.canonical_name, s.item_name) ASC
  `
  cachedGmcWeekly = rows
  cachedGmcWeeklyTime = Date.now()
  return NextResponse.json(rows)
}
