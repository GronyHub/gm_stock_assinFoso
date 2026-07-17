import sql from '@/lib/db'
import { DAILY_ITEM_IDS } from '@/lib/countRules'
import { NextResponse } from 'next/server'

// The periodic (default 15-day) count list, with cadence rules:
// - Services are never countable and never appear.
// - GMC items (goods with internal-use history) live on the 7-day list
//   (/api/stock/gmc-weekly) instead, so they're excluded here.
// - An item whose last 2+ counts were all ZERO with no bill since is dormant:
//   there's nothing on the shelf and nothing has been bought, so it drops off
//   the count list entirely until a bill brings it back.
// - An item counted at the SAME number on its last 3 counts with no bill
//   since clearly isn't moving, so its cadence relaxes to 30 days.
export async function GET() {
  const rows = await sql`
    WITH ranked AS (
      SELECT item_id, count_date::date AS d, quantity_counted,
             ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY count_date DESC, id DESC) AS rn
      FROM stock_counts
    ),
    recent AS (
      SELECT item_id,
             COUNT(*) FILTER (WHERE rn <= 2) AS n2,
             BOOL_AND(quantity_counted = 0) FILTER (WHERE rn <= 2) AS zeros2,
             MIN(d) FILTER (WHERE rn <= 2) AS since2,
             COUNT(*) FILTER (WHERE rn <= 3) AS n3,
             COUNT(DISTINCT quantity_counted) FILTER (WHERE rn <= 3) AS distinct3,
             MIN(d) FILTER (WHERE rn <= 3) AS since3
      FROM ranked
      WHERE rn <= 3
      GROUP BY item_id
    ),
    last_bill AS (
      SELECT bl.item_id, MAX(b.bill_date::date) AS d
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      GROUP BY bl.item_id
    ),
    gmc_items AS (
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
      COALESCE(i.canonical_name, s.item_name) AS item_name,
      s.cf_group,
      s.calculated_soh,
      c.last_count_date,
      cad.days AS cadence_days,
      CASE
        WHEN c.last_count_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - c.last_count_date::date - cad.days)
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN items i ON i.id = s.item_id
    LEFT JOIN lastc c ON c.item_id = s.item_id
    LEFT JOIN recent r ON r.item_id = s.item_id
    LEFT JOIN last_bill lb ON lb.item_id = s.item_id
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN COALESCE(r.n3, 0) = 3 AND r.distinct3 = 1 AND (lb.d IS NULL OR lb.d <= r.since3)
        THEN 30 ELSE 15
      END AS days
    ) cad
    WHERE s.item_id <> ALL(${DAILY_ITEM_IDS})
      AND s.item_name NOT ILIKE 'old stop%'
      AND s.item_name NOT ILIKE 'old- stop%'
      AND s.item_name NOT ILIKE 'service%'
      AND s.item_name NOT ILIKE 'service-%'
      AND s.cf_group IS DISTINCT FROM 'Large Format'
      AND COALESCE(i.product_type, 'goods') <> 'service'
      AND (s.cf_group IS NULL OR s.cf_group NOT ILIKE 'service%')
      AND s.item_id NOT IN (SELECT item_id FROM gmc_items)
      AND NOT (COALESCE(r.n2, 0) >= 2 AND COALESCE(r.zeros2, false) AND (lb.d IS NULL OR lb.d <= r.since2))
      AND (c.last_count_date IS NULL
       OR c.last_count_date::date < CURRENT_DATE - cad.days)
    ORDER BY
      CASE WHEN c.last_count_date IS NULL THEN 999999
           ELSE (CURRENT_DATE - c.last_count_date::date)
      END DESC,
      COALESCE(i.canonical_name, s.item_name) ASC
  `
  return NextResponse.json(rows)
}
