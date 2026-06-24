import sql from '@/lib/db'
import { NextResponse } from 'next/server'

async function safeQuery(query: () => Promise<any[]>, fallback: any[] = []): Promise<any[]> {
  try { return await query() } catch (e) { console.error('[flags]', e); return fallback }
}

// ── Duplicate filtering rules ────────────────────────────────────────────────

// Paper — include large format (A0/A1/A2)
function paperSize(n: string) { return n.match(/\b(A0|A1|A2|A3|A4|A5)\b/i)?.[1]?.toUpperCase() ?? null }
function paperGrams(n: string) {
  // With explicit unit suffix (most reliable)
  const withUnit = n.match(/\b(\d{2,3})\s*(?:g\b|grams?\b|gsm\b)/i)?.[1]
  if (withUnit) return withUnit
  // Bare 3-digit number in 100–399 range (covers "A4 210" style names)
  // Only when the name also contains a photo-paper keyword to avoid false positives
  if (/photo|gloss|matte|satin|lustre|silk/i.test(n)) {
    return n.match(/\b(1\d{2}|2\d{2}|3\d{2})\b/)?.[1] ?? null
  }
  return null
}
function isGramPaper(n: string) {
  return paperSize(n) !== null && paperGrams(n) !== null &&
    !/toner|refill|cartridge|binding|slide/i.test(n)
}

// Toners / cartridges
function tonerCode(n: string): string | null {
  const m = [...n.matchAll(/\b([A-Z]?\d{1,4}[A-Z])\b/gi)].map(x => x[1].toUpperCase())
  return m[0] ?? null
}
function isToner(n: string) { return /\b(toner|cartridge)\b/i.test(n) }

// Inks
function inkVolume(n: string) { return n.match(/\b(\d+)\s*ml\b/i)?.[1] ?? null }
function inkColor(n: string) {
  const m = n.match(/[-–]\s*(.+)$/)
  return m ? m[1].trim().toLowerCase().replace(/\s+/g, ' ') : null
}
function isInk(n: string) { return /\bink\b/i.test(n) && /\d\s*ml/i.test(n) && !/toner/i.test(n) }

// Binding slides — same alphanumeric code = duplicate; different code = different item
function isBindingSlide(n: string) { return /binding\s*slide|slide.*binding/i.test(n) }
function bindingSlideCode(n: string): string | null {
  // Extract alphanumeric codes like A4, A3, 10mm, 16mm, etc.
  const m = [...n.matchAll(/\b([A-Z]\d+|\d+[A-Z]+|\d{1,3}\s*mm)\b/gi)].map(x => x[1].toUpperCase().replace(/\s+/g, ''))
  return m.length ? m.join('-') : null
}

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
  if (isBindingSlide(n1) && isBindingSlide(n2)) {
    const c1 = bindingSlideCode(n1), c2 = bindingSlideCode(n2)
    return c1 !== null && c1 === c2
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
    uncheckedCab,
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

    // 2. Days with no sales receipt (exclude Sundays, today, and no-work days)
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
        AND d NOT IN (SELECT work_date FROM no_work_days)
      ORDER BY d DESC
    `),

    // 3. Duplicate/similar item names (tries pg_trgm similarity; exact-match fallback)
    safeQuery(async () => {
      try { await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm` } catch {}
      try {
        return await sql`
          SELECT a.id AS id1, a.canonical_name AS name1,
                 b.id AS id2, b.canonical_name AS name2
          FROM items a
          JOIN items b ON a.id < b.id
            AND (
              LOWER(TRIM(a.canonical_name)) = LOWER(TRIM(b.canonical_name))
              OR SIMILARITY(LOWER(a.canonical_name), LOWER(b.canonical_name)) > 0.65
            )
          WHERE LOWER(a.status) = 'active' AND LOWER(b.status) = 'active'
            AND a.canonical_name NOT ILIKE 'old stop%'
            AND b.canonical_name NOT ILIKE 'old stop%'
            AND a.canonical_name NOT ILIKE 'old-stop%'
            AND b.canonical_name NOT ILIKE 'old-stop%'
            AND NOT EXISTS (
              SELECT 1 FROM dismissed_duplicates dd
              WHERE dd.item_id1 = LEAST(a.id, b.id) AND dd.item_id2 = GREATEST(a.id, b.id)
            )
          ORDER BY a.canonical_name
        `
      } catch {
        // pg_trgm unavailable — exact match only
        return await sql`
          SELECT a.id AS id1, a.canonical_name AS name1,
                 b.id AS id2, b.canonical_name AS name2
          FROM items a
          JOIN items b ON a.id < b.id
            AND LOWER(TRIM(a.canonical_name)) = LOWER(TRIM(b.canonical_name))
          WHERE LOWER(a.status) = 'active' AND LOWER(b.status) = 'active'
            AND a.canonical_name NOT ILIKE 'old stop%'
            AND b.canonical_name NOT ILIKE 'old stop%'
            AND a.canonical_name NOT ILIKE 'old-stop%'
            AND b.canonical_name NOT ILIKE 'old-stop%'
            AND NOT EXISTS (
              SELECT 1 FROM dismissed_duplicates dd
              WHERE dd.item_id1 = LEAST(a.id, b.id) AND dd.item_id2 = GREATEST(a.id, b.id)
            )
          ORDER BY a.canonical_name
        `
      }
    }),

    // 4. Sales lines where cost >= selling price
    safeQuery(() => sql`
      SELECT sr.id AS receipt_id, sr.receipt_number, sr.receipt_date::text AS receipt_date,
             i.id AS item_id, COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name,
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

    // 5. Item names in receipts or counts not matching any canonical_name in inventory
    safeQuery(() => sql`
      SELECT item_name, source FROM (
        SELECT DISTINCT COALESCE(resolved_name, raw_item_name) AS item_name, 'Sales Receipt' AS source
        FROM sales_receipt_lines
        WHERE NOT EXISTS (
          SELECT 1 FROM items i
          WHERE LOWER(i.canonical_name) = LOWER(COALESCE(resolved_name, raw_item_name))
        )
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

    // 8. Weeks with no cash-at-bank confirmation (cab_total not recorded)
    safeQuery(() => sql`
      WITH week_series AS (
        SELECT DATE_TRUNC('week', generate_series(
          DATE_TRUNC('week', (SELECT MIN(entry_date) FROM cash_at_bank)),
          DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days',
          INTERVAL '1 week'
        ))::date AS week_start
      )
      SELECT
        w.week_start::text,
        (w.week_start + INTERVAL '6 days')::date::text AS week_end
      FROM week_series w
      WHERE NOT EXISTS (
        SELECT 1 FROM cash_at_bank cab
        WHERE cab.entry_date >= w.week_start
          AND cab.entry_date <= w.week_start + INTERVAL '6 days'
          AND cab.cab_total IS NOT NULL
      )
      ORDER BY w.week_start DESC
    `),
  ])

  const filteredDups = duplicates.filter((r: any) => shouldKeepPair(r.name1, r.name2))

  return NextResponse.json({ noCash, missingDays, duplicates: filteredDups, costGteSell, notInInventory, noGroup, noStaffTimes, uncheckedCab })
}
