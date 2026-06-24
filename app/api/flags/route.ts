import sql from '@/lib/db'
import { NextResponse } from 'next/server'

async function safeQuery(query: () => Promise<any[]>, fallback: any[] = []): Promise<any[]> {
  try { return await query() } catch (e) { console.error('[flags]', e); return fallback }
}

export async function GET() {
  const [
    noCash,
    missingDays,
    duplicates,
    costGteSell,
    notInInventory,
    noGroup,
    noStaffTimes,
  ] = await Promise.all([

    // 1. Walk-in customers with no cash counted
    safeQuery(() => sql`
      SELECT id, receipt_number, receipt_date::text AS receipt_date,
             customer_name, total AS invoice_amount
      FROM sales_receipts
      WHERE LOWER(TRIM(customer_name)) = 'walk in customer'
        AND (cash_counted IS NULL OR cash_counted = 0)
      ORDER BY receipt_date DESC
    `),

    // 2. Days with no sales receipt (exclude Sundays and today)
    safeQuery(() => sql`
      WITH date_series AS (
        SELECT generate_series(
          (SELECT MIN(receipt_date) FROM sales_receipts),
          CURRENT_DATE - INTERVAL '1 day',
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT d::text AS missing_date
      FROM date_series
      WHERE EXTRACT(DOW FROM d) <> 0
        AND d NOT IN (SELECT DISTINCT receipt_date::date FROM sales_receipts)
      ORDER BY d DESC
    `),

    // 3. Duplicate/similar item names (requires pg_trgm; falls back to exact-match only)
    safeQuery(async () => {
      try {
        await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`
      } catch {}
      return sql`
        SELECT a.id AS id1, a.canonical_name AS name1,
               b.id AS id2, b.canonical_name AS name2
        FROM items a
        JOIN items b ON a.id < b.id
          AND (
            LOWER(TRIM(a.canonical_name)) = LOWER(TRIM(b.canonical_name))
            OR SIMILARITY(LOWER(a.canonical_name), LOWER(b.canonical_name)) > 0.7
          )
        WHERE a.status NOT IN ('inactive') AND b.status NOT IN ('inactive')
        ORDER BY a.canonical_name
      `
    }),

    // 4. Sales lines where cost >= selling price
    safeQuery(() => sql`
      SELECT sr.receipt_number, sr.receipt_date::text AS receipt_date,
             COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name,
             srl.item_price AS selling_price,
             i.purchase_rate AS cost_price
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      JOIN items i ON i.id = srl.item_id
      WHERE i.purchase_rate IS NOT NULL
        AND srl.item_price IS NOT NULL
        AND i.purchase_rate >= srl.item_price
        AND srl.item_price > 0
      ORDER BY sr.receipt_date DESC
    `),

    // 5. Item names in receipts or counts not in inventory
    safeQuery(() => sql`
      SELECT item_name, source FROM (
        SELECT DISTINCT COALESCE(resolved_name, raw_item_name) AS item_name, 'Sales Receipt' AS source
        FROM sales_receipt_lines
        WHERE item_id IS NULL
        UNION
        SELECT DISTINCT item_name, 'Stock Count' AS source
        FROM stock_counts sc
        WHERE NOT EXISTS (
          SELECT 1 FROM items i WHERE LOWER(i.canonical_name) = LOWER(sc.item_name)
        )
      ) t
      ORDER BY item_name
    `),

    // 6. Items with no group
    safeQuery(() => sql`
      SELECT id, canonical_name AS item_name, status
      FROM items
      WHERE (cf_group IS NULL OR TRIM(cf_group) = '')
        AND status NOT IN ('inactive')
      ORDER BY canonical_name
    `),

    // 7. Days with no staff times at all (exclude Sundays and today)
    safeQuery(() => sql`
      WITH date_series AS (
        SELECT generate_series(
          (SELECT MIN(work_date) FROM staff_times),
          CURRENT_DATE - INTERVAL '1 day',
          INTERVAL '1 day'
        )::date AS d
      )
      SELECT d::text AS missing_date
      FROM date_series
      WHERE EXTRACT(DOW FROM d) <> 0
        AND d NOT IN (SELECT DISTINCT work_date FROM staff_times WHERE actual_in IS NOT NULL)
      ORDER BY d DESC
    `),
  ])

  return NextResponse.json({ noCash, missingDays, duplicates, costGteSell, notInInventory, noGroup, noStaffTimes })
}
