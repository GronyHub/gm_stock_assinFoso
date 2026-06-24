import sql from '@/lib/db'
import { NextResponse } from 'next/server'

async function safeQuery(query: () => Promise<any[]>, fallback: any[] = []): Promise<any[]> {
  try { return await query() } catch (e) { console.error('[flags]', e); return fallback }
}

// ── Duplicate filtering rules ────────────────────────────────────────────────

function paperSize(n: string) { return n.match(/\b(A3|A4|A5)\b/i)?.[1]?.toUpperCase() ?? null }
function paperGrams(n: string) { return n.match(/\b(\d{2,3})\s*(?:g\b|grams?\b|gsm\b)/i)?.[1] ?? null }
function isGramPaper(n: string) { return paperSize(n) !== null && paperGrams(n) !== null && !/toner|refill|cartridge/i.test(n) }

function tonerCode(n: string): string | null {
  // Match codes like 105A, 55A, CF217A — alphanumeric ending in a letter
  const m = [...n.matchAll(/\b([A-Z]?\d{1,4}[A-Z])\b/gi)].map(x => x[1].toUpperCase())
  return m[0] ?? null
}
function isToner(n: string) { return /\b(toner|cartridge)\b/i.test(n) }

function inkVolume(n: string) { return n.match(/\b(\d+)\s*ml\b/i)?.[1] ?? null }
function inkColor(n: string) {
  const m = n.match(/[-–]\s*(.+)$/)
  return m ? m[1].trim().toLowerCase().replace(/\s+/g, ' ') : null
}
function isInk(n: string) { return /\bink\b/i.test(n) && /\d\s*ml/i.test(n) && !/toner/i.test(n) }

function shouldKeepPair(n1: string, n2: string): boolean {
  if (isGramPaper(n1) && isGramPaper(n2)) {
    return paperSize(n1) === paperSize(n2) && paperGrams(n1) === paperGrams(n2)
  }
  if (isToner(n1) && isToner(n2)) {
    const c1 = tonerCode(n1), c2 = tonerCode(n2)
    return c1 !== null && c1 === c2
  }
  if (isInk(n1) && isInk(n2)) {
    return inkVolume(n1) === inkVolume(n2) && inkColor(n1) === inkColor(n2)
  }
  return true
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
        WHERE LOWER(a.status) = 'active' AND LOWER(b.status) = 'active'
          AND a.canonical_name NOT ILIKE 'old stop%'
          AND b.canonical_name NOT ILIKE 'old stop%'
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
        AND LOWER(status) = 'active'
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

  const filteredDups = duplicates.filter((r: any) => shouldKeepPair(r.name1, r.name2))

  return NextResponse.json({ noCash, missingDays, duplicates: filteredDups, costGteSell, notInInventory, noGroup, noStaffTimes })
}
