import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Dry run: recompute what calculated_soh would become if item_stock_summary
// credited pack->singles GMC conversions (the same "converted_in" concept
// itemDayRows.ts / LossTab's CNV column already uses), without touching the
// live view. Diffs against the CURRENT calculated_soh for every affected
// item so the blast radius is visible before anything is applied.
export async function GET() {
  try {
    const rows = await sql`
      WITH latest_count AS (
        SELECT DISTINCT ON (stock_counts.item_id) stock_counts.item_id,
          stock_counts.count_date, stock_counts.quantity_counted
        FROM stock_counts WHERE stock_counts.item_id IS NOT NULL
        ORDER BY stock_counts.item_id, stock_counts.count_date DESC
      ),
      conversions_since AS (
        SELECT src.converts_to_item_id AS item_id,
          SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty_converted
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        JOIN items src ON src.id = srl.item_id
        LEFT JOIN latest_count lc1 ON lc1.item_id = src.converts_to_item_id
        WHERE src.converts_to_item_id IS NOT NULL
          AND COALESCE(src.product_type, 'goods') <> 'service'
          AND sr.customer_name = 'Grony Multimedia as Customer'
          AND sr.receipt_date > COALESCE(lc1.count_date, '1900-01-01'::date)
        GROUP BY src.converts_to_item_id
      ),
      all_conversions AS (
        SELECT src.converts_to_item_id AS item_id,
          SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS total_converted
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        JOIN items src ON src.id = srl.item_id
        WHERE src.converts_to_item_id IS NOT NULL
          AND COALESCE(src.product_type, 'goods') <> 'service'
          AND sr.customer_name = 'Grony Multimedia as Customer'
        GROUP BY src.converts_to_item_id
      )
      SELECT s.item_id, s.item_name, s.calculated_soh AS old_soh,
             COALESCE(cs.qty_converted, 0) AS conversions_since_count,
             COALESCE(ac.total_converted, 0) AS total_converted_in,
             s.calculated_soh + COALESCE(cs.qty_converted, 0) AS new_soh
      FROM item_stock_summary s
      LEFT JOIN conversions_since cs ON cs.item_id = s.item_id
      LEFT JOIN all_conversions ac ON ac.item_id = s.item_id
      WHERE COALESCE(ac.total_converted, 0) > 0
      ORDER BY (COALESCE(cs.qty_converted, 0)) DESC
    `
    return NextResponse.json(rows)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
