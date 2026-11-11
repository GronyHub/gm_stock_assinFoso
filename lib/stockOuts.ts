import sql from '@/lib/db'
import { once } from '@/lib/once'
import { clearItemsCache } from '@/lib/itemsCache'

// Stock that leaves the shop without a sales receipt: the goods of a pending job when the customer collects it (the money came in as job payments, so no receipt
// exists to deduct them). Stock on hand (the item_stock_summary view) subtracts these since the last count, and the loss figure expects them to be gone.
export const ensureStockOuts = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS stock_outs (
    id SERIAL PRIMARY KEY, item_id INTEGER NOT NULL, qty NUMERIC NOT NULL, day DATE NOT NULL DEFAULT CURRENT_DATE, source TEXT NOT NULL DEFAULT 'pending_job',
    ref TEXT, note TEXT, created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS stock_outs_item ON stock_outs (item_id, day)`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS stock_outs_ref ON stock_outs (ref)`.catch(() => {})
  // Once: the stock summary view learns about stock_outs (new columns go last, so everything that reads it keeps working).
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('stock-summary-stock-outs-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    await sql.query(STOCK_SUMMARY_VIEW)
  } catch (e) {
    console.error('stock summary view update failed:', e instanceof Error ? e.message : String(e))
    await sql`DELETE FROM law_migrations WHERE key = 'stock-summary-stock-outs-2026-11-13'`.catch(() => {})
  }
})

// A job's goods go out when it is collected: one row per goods line with an item (services have no stock), for jobs that are not already a sale in the Sales Log.
export async function recordJobStockOut(jobId: number, by: string) {
  await ensureStockOuts()
  await sql`DELETE FROM stock_outs WHERE ref = ${'job:' + jobId}`
  await sql`INSERT INTO stock_outs (item_id, qty, source, ref, note, created_by)
    SELECT (l->>'item_id')::int, (l->>'qty')::numeric, 'pending_job', ${'job:' + jobId}, j.customer, ${by}
    FROM pending_jobs j, jsonb_array_elements(j.lines) l
    JOIN items i ON i.id = (l->>'item_id')::int
    WHERE j.id = ${jobId} AND j.source = 'job' AND NOT j.prepaid AND (l->>'item_id') ~ '^[0-9]+$' AND COALESCE((l->>'qty')::numeric, 0) > 0
      AND COALESCE(i.product_type, 'goods') <> 'service'`
  clearItemsCache()
}
export async function clearJobStockOut(jobId: number) {
  await ensureStockOuts()
  await sql`DELETE FROM stock_outs WHERE ref = ${'job:' + jobId}`
  clearItemsCache()
}

const STOCK_SUMMARY_VIEW = `CREATE OR REPLACE VIEW item_stock_summary AS
 WITH latest_count AS (
         SELECT DISTINCT ON (stock_counts.item_id) stock_counts.item_id, stock_counts.count_date, stock_counts.quantity_counted
           FROM stock_counts WHERE stock_counts.item_id IS NOT NULL
          ORDER BY stock_counts.item_id, stock_counts.count_date DESC
        ), sales_since AS (
         SELECT srl.item_id, sum(COALESCE(srl.quantity, 0::numeric)) AS qty_sold
           FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id LEFT JOIN latest_count lc1 ON lc1.item_id = srl.item_id
          WHERE srl.item_id IS NOT NULL AND sr.receipt_date > COALESCE(lc1.count_date, '1900-01-01'::date)
          GROUP BY srl.item_id
        ), purchases_since AS (
         SELECT bl.item_id, sum(COALESCE(bl.quantity, 0::numeric)) AS qty_purchased
           FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id LEFT JOIN latest_count lc1 ON lc1.item_id = bl.item_id
          WHERE bl.item_id IS NOT NULL AND b.bill_date > COALESCE(lc1.count_date, '1900-01-01'::date)
          GROUP BY bl.item_id
        ), all_sales AS (
         SELECT sales_receipt_lines.item_id, sum(COALESCE(sales_receipt_lines.quantity, 0::numeric)) AS total_sold
           FROM sales_receipt_lines WHERE sales_receipt_lines.item_id IS NOT NULL GROUP BY sales_receipt_lines.item_id
        ), all_purchases AS (
         SELECT bill_lines.item_id, sum(COALESCE(bill_lines.quantity, 0::numeric)) AS total_purchased
           FROM bill_lines WHERE bill_lines.item_id IS NOT NULL GROUP BY bill_lines.item_id
        ), conversions_since AS (
         SELECT src.converts_to_item_id AS item_id, sum(srl.quantity * COALESCE(src.units_per_pack, 1::numeric)) AS qty_converted
           FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id JOIN items src ON src.id = srl.item_id
             LEFT JOIN latest_count lc1 ON lc1.item_id = src.converts_to_item_id
          WHERE src.converts_to_item_id IS NOT NULL AND COALESCE(src.product_type, 'goods'::text) <> 'service'::text AND sr.customer_name = 'Grony Multimedia as Customer'::text AND sr.receipt_date > COALESCE(lc1.count_date, '1900-01-01'::date)
          GROUP BY src.converts_to_item_id
        ), all_conversions AS (
         SELECT src.converts_to_item_id AS item_id, sum(srl.quantity * COALESCE(src.units_per_pack, 1::numeric)) AS total_converted
           FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id JOIN items src ON src.id = srl.item_id
          WHERE src.converts_to_item_id IS NOT NULL AND COALESCE(src.product_type, 'goods'::text) <> 'service'::text AND sr.customer_name = 'Grony Multimedia as Customer'::text
          GROUP BY src.converts_to_item_id
        ), stock_out_since AS (
         SELECT so.item_id, sum(so.qty) AS qty_out
           FROM stock_outs so LEFT JOIN latest_count lc1 ON lc1.item_id = so.item_id
          WHERE so.day > COALESCE(lc1.count_date, '1900-01-01'::date)
          GROUP BY so.item_id
        ), all_stock_out AS (
         SELECT item_id, sum(qty) AS total_out FROM stock_outs GROUP BY item_id
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
    COALESCE(ap.total_purchased, 0::numeric) AS total_purchased,
    COALESCE(as2.total_sold, 0::numeric) AS total_sold,
    COALESCE(lc.quantity_counted, COALESCE(i.opening_stock, 0::numeric)) + COALESCE(ps.qty_purchased, 0::numeric) - COALESCE(ss.qty_sold, 0::numeric) + COALESCE(cs.qty_converted, 0::numeric) - COALESCE(so2.qty_out, 0::numeric) AS calculated_soh,
        CASE
            WHEN lc.item_id IS NOT NULL THEN COALESCE(i.opening_stock, 0::numeric) + COALESCE(ap.total_purchased, 0::numeric) - COALESCE(as2.total_sold, 0::numeric) + COALESCE(ac.total_converted, 0::numeric) - COALESCE(aso.total_out, 0::numeric) - lc.quantity_counted
            ELSE NULL::numeric
        END AS calculated_loss,
    i.track_inventory,
    i.source,
    COALESCE(cs.qty_converted, 0::numeric) AS conversions_since_count,
    COALESCE(ac.total_converted, 0::numeric) AS total_converted_in,
    COALESCE(so2.qty_out, 0::numeric) AS stock_out_since_count,
    COALESCE(aso.total_out, 0::numeric) AS total_stock_out
   FROM items i
     LEFT JOIN latest_count lc ON lc.item_id = i.id
     LEFT JOIN sales_since ss ON ss.item_id = i.id
     LEFT JOIN purchases_since ps ON ps.item_id = i.id
     LEFT JOIN all_sales as2 ON as2.item_id = i.id
     LEFT JOIN all_purchases ap ON ap.item_id = i.id
     LEFT JOIN conversions_since cs ON cs.item_id = i.id
     LEFT JOIN all_conversions ac ON ac.item_id = i.id
     LEFT JOIN stock_out_since so2 ON so2.item_id = i.id
     LEFT JOIN all_stock_out aso ON aso.item_id = i.id
  WHERE i.track_inventory = true OR lc.item_id IS NOT NULL OR as2.item_id IS NOT NULL OR ap.item_id IS NOT NULL OR aso.item_id IS NOT NULL
  ORDER BY i.canonical_name`
