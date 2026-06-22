import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    WITH counts AS (
      SELECT item_id, MAX(count_date) AS last_date
      FROM stock_counts
      GROUP BY item_id

      UNION ALL

      SELECT ial.item_id, MAX(ia.adj_date) AS last_date
      FROM inventory_adjustment_lines ial
      JOIN inventory_adjustments ia ON ia.id = ial.adj_id
      WHERE ial.item_id IS NOT NULL AND ial.unresolved = false
      GROUP BY ial.item_id
    ),
    effective AS (
      SELECT item_id, MAX(last_date) AS last_count_date
      FROM counts
      GROUP BY item_id
    )
    SELECT
      s.item_id,
      s.item_name,
      s.cf_group,
      s.calculated_soh,
      e.last_count_date,
      CASE
        WHEN e.last_count_date IS NULL THEN NULL
        ELSE (CURRENT_DATE - e.last_count_date::date - 15)
      END AS days_overdue
    FROM item_stock_summary s
    LEFT JOIN effective e ON e.item_id = s.item_id
    WHERE e.last_count_date IS NULL
       OR e.last_count_date::date < CURRENT_DATE - INTERVAL '15 days'
    ORDER BY
      CASE WHEN e.last_count_date IS NULL THEN 999999
           ELSE (CURRENT_DATE - e.last_count_date::date)
      END DESC,
      s.item_name ASC
  `
  return NextResponse.json(rows)
}
