import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const id = Number(itemId)

  const rows = await sql`
    WITH daily_converted_in AS (
      -- Credit from another good's GMC take, if that good declares
      -- converts_to_item_id = this item (see /api/losses/summary for the general case).
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ${id}
        AND COALESCE(src.product_type, 'goods') <> 'service'
        AND sr.customer_name = 'Grony Multimedia as Customer'
      GROUP BY sr.receipt_date::date
    ),
    daily_consumed_by_service AS (
      -- Deduction from another service's own real (WIC) sales, if that service declares
      -- converts_to_item_id = this item (e.g. Passport Printing consuming this paper).
      -- Kept per-source (grouped by service too) so callers can show a breakdown, not
      -- just a combined total, when more than one service draws on the same stock.
      SELECT sr.receipt_date::date AS d, src.id AS source_id, src.canonical_name AS source_name,
             SUM(srl.quantity * COALESCE(src.units_per_pack, 1)) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items src ON src.id = srl.item_id
      WHERE src.converts_to_item_id = ${id}
        AND src.product_type = 'service'
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date, src.id, src.canonical_name
    ),
    daily_consumed_via_service AS (
      SELECT d, SUM(qty) AS qty,
             json_agg(json_build_object('name', source_name, 'qty', qty) ORDER BY source_name) AS breakdown
      FROM daily_consumed_by_service
      GROUP BY d
    ),
    all_dates AS (
      SELECT count_date::date AS d FROM stock_counts WHERE item_id = ${id}
      UNION
      SELECT sr.receipt_date::date
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE srl.item_id = ${id}
      UNION
      SELECT b.bill_date::date
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${id}
      UNION
      SELECT d FROM daily_converted_in
      UNION
      SELECT d FROM daily_consumed_via_service
    ),
    daily_counts AS (
      SELECT count_date::date AS d, SUM(quantity_counted) AS qty_counted
      FROM stock_counts
      WHERE item_id = ${id}
      GROUP BY count_date::date
    ),
    daily_wic AS (
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id}
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date
    ),
    daily_gmc AS (
      SELECT sr.receipt_date::date AS d, SUM(srl.quantity) AS qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id}
        AND sr.customer_name = 'Grony Multimedia as Customer'
      GROUP BY sr.receipt_date::date
    ),
    daily_bills AS (
      SELECT b.bill_date::date AS d, SUM(bl.quantity) AS qty
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id = ${id}
      GROUP BY b.bill_date::date
    ),
    daily_sp AS (
      SELECT sr.receipt_date::date AS d, AVG(srl.item_price) AS sp
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${id} AND srl.item_price IS NOT NULL
        AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
      GROUP BY sr.receipt_date::date
    ),
    daily_aliases AS (
      SELECT d, STRING_AGG(DISTINCT alias, ' / ' ORDER BY alias) AS aliases
      FROM (
        SELECT sr.receipt_date::date AS d, srl.raw_item_name AS alias
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE srl.item_id = ${id}
          AND srl.raw_item_name IS NOT NULL AND TRIM(srl.raw_item_name) <> ''
        UNION ALL
        SELECT b.bill_date::date AS d, bl.raw_item_name AS alias
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${id}
          AND bl.raw_item_name IS NOT NULL AND TRIM(bl.raw_item_name) <> ''
      ) sub
      GROUP BY d
    )
    SELECT
      ad.d::text AS date,
      dc.qty_counted,
      COALESCE(dw.qty, 0) + COALESCE(dcs.qty, 0) AS wic_qty,
      dg.qty  AS gmc_qty,
      db.qty  AS bills_qty,
      dsp.sp  AS sell_price,
      da.aliases,
      dci.qty AS converted_in_qty,
      dcs.breakdown AS wic_breakdown
    FROM all_dates ad
    LEFT JOIN daily_counts dc ON dc.d = ad.d
    LEFT JOIN daily_wic    dw ON dw.d = ad.d
    LEFT JOIN daily_gmc    dg ON dg.d = ad.d
    LEFT JOIN daily_bills  db ON db.d = ad.d
    LEFT JOIN daily_sp    dsp ON dsp.d = ad.d
    LEFT JOIN daily_aliases da ON da.d = ad.d
    LEFT JOIN daily_converted_in dci ON dci.d = ad.d
    LEFT JOIN daily_consumed_via_service dcs ON dcs.d = ad.d
    ORDER BY ad.d ASC
  `

  return NextResponse.json(rows)
}
