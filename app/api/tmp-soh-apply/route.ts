import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Applies the pack->singles conversion credit to item_stock_summary
// (CREATE OR REPLACE VIEW -- safe/idempotent, no data mutated, only the
// view's own formula). Adds conversions_since_count/total_converted_in
// columns and folds them into calculated_soh/calculated_loss so the "SOH"
// figure finally agrees with the Item 360 Detail page's own CNV-aware math.
export async function GET() {
  try {
    await sql`
      CREATE OR REPLACE VIEW item_stock_summary AS
      WITH latest_count AS (
        SELECT DISTINCT ON (stock_counts.item_id) stock_counts.item_id,
          stock_counts.count_date, stock_counts.quantity_counted
        FROM stock_counts WHERE stock_counts.item_id IS NOT NULL
        ORDER BY stock_counts.item_id, stock_counts.count_date DESC
      ),
      sales_since AS (
        SELECT srl.item_id, SUM(COALESCE(srl.quantity, 0::numeric)) AS qty_sold
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        LEFT JOIN latest_count lc1 ON lc1.item_id = srl.item_id
        WHERE srl.item_id IS NOT NULL AND sr.receipt_date > COALESCE(lc1.count_date, '1900-01-01'::date)
        GROUP BY srl.item_id
      ),
      purchases_since AS (
        SELECT bl.item_id, SUM(COALESCE(bl.quantity, 0::numeric)) AS qty_purchased
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        LEFT JOIN latest_count lc1 ON lc1.item_id = bl.item_id
        WHERE bl.item_id IS NOT NULL AND b.bill_date > COALESCE(lc1.count_date, '1900-01-01'::date)
        GROUP BY bl.item_id
      ),
      all_sales AS (
        SELECT sales_receipt_lines.item_id, SUM(COALESCE(sales_receipt_lines.quantity, 0::numeric)) AS total_sold
        FROM sales_receipt_lines
        WHERE sales_receipt_lines.item_id IS NOT NULL
        GROUP BY sales_receipt_lines.item_id
      ),
      all_purchases AS (
        SELECT bill_lines.item_id, SUM(COALESCE(bill_lines.quantity, 0::numeric)) AS total_purchased
        FROM bill_lines
        WHERE bill_lines.item_id IS NOT NULL
        GROUP BY bill_lines.item_id
      ),
      -- Pack->singles credit: when a GOODS item that declares
      -- converts_to_item_id = this item is sold to "Grony Multimedia as
      -- Customer" (the internal-use/breakdown convention), that's a pack
      -- being broken open -- credit this item with qty * units_per_pack.
      -- Same rule Item 360's Detail page (CNV column, lib/itemDayRows.ts)
      -- already uses, now folded into the SOH everyone actually looks at.
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
      SELECT i.id AS item_id,
        i.canonical_name AS item_name,
        i.cf_group,
        i.unit_name,
        COALESCE(i.opening_stock, 0::numeric) AS opening_stock,
        lc.count_date AS last_count_date,
        lc.quantity_counted AS last_count_qty,
        COALESCE(ps.qty_purchased, 0::numeric) AS purchases_since_count,
        COALESCE(ss.qty_sold, 0::numeric) AS sales_since_count,
        COALESCE(cs.qty_converted, 0::numeric) AS conversions_since_count,
        COALESCE(ap.total_purchased, 0::numeric) AS total_purchased,
        COALESCE(as2.total_sold, 0::numeric) AS total_sold,
        COALESCE(ac.total_converted, 0::numeric) AS total_converted_in,
        COALESCE(lc.quantity_counted, COALESCE(i.opening_stock, 0::numeric))
          + COALESCE(ps.qty_purchased, 0::numeric) - COALESCE(ss.qty_sold, 0::numeric)
          + COALESCE(cs.qty_converted, 0::numeric) AS calculated_soh,
        CASE
          WHEN lc.item_id IS NOT NULL THEN
            COALESCE(i.opening_stock, 0::numeric) + COALESCE(ap.total_purchased, 0::numeric)
              - COALESCE(as2.total_sold, 0::numeric) + COALESCE(ac.total_converted, 0::numeric)
              - lc.quantity_counted
          ELSE NULL::numeric
        END AS calculated_loss,
        i.track_inventory,
        i.source
      FROM items i
        LEFT JOIN latest_count lc ON lc.item_id = i.id
        LEFT JOIN sales_since ss ON ss.item_id = i.id
        LEFT JOIN purchases_since ps ON ps.item_id = i.id
        LEFT JOIN all_sales as2 ON as2.item_id = i.id
        LEFT JOIN all_purchases ap ON ap.item_id = i.id
        LEFT JOIN conversions_since cs ON cs.item_id = i.id
        LEFT JOIN all_conversions ac ON ac.item_id = i.id
      WHERE i.track_inventory = true OR lc.item_id IS NOT NULL OR as2.item_id IS NOT NULL OR ap.item_id IS NOT NULL
      ORDER BY i.canonical_name
    `

    const after = await sql`
      SELECT item_id, item_name, calculated_soh, conversions_since_count, total_converted_in
      FROM item_stock_summary
      WHERE item_id IN (375, 369, 367, 373, 50, 278, 380, 374, 198, 370, 197)
      ORDER BY item_id
    `
    return NextResponse.json({ ok: true, after })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
