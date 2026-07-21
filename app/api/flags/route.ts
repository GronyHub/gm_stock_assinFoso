import sql from '@/lib/db'
import { ensureAdvertStatusTable } from '@/lib/advertStatus'
import { ensureManageLogs } from '@/lib/manageLogs'
import { ensureClosingReports } from '@/lib/closingReports'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function safeQuery(query: () => Promise<any[]>, fallback: any[] = []): Promise<any[]> {
  try { return await query() } catch (e) { console.error('[flags]', e); return fallback }
}

// Most recent required equipment-check day (every Monday and Thursday) on
// or before today, as YYYY-MM-DD.
function lastRequiredEquipmentCheckDate(): string {
  const today = new Date()
  const day = today.getDay() // Sunday = 0 .. Saturday = 6
  const sinceMonday = (day + 6) % 7
  const sinceThursday = (day + 3) % 7
  const daysSince = Math.min(sinceMonday, sinceThursday)
  const due = new Date(today)
  due.setDate(due.getDate() - daysSince)
  return due.toISOString().slice(0, 10)
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

// Slides (binding slides and their binding services) — same alphanumeric code = duplicate; different code = different item
function isSlideItem(n: string) { return /\bslides?\b/i.test(n) }
function slideCode(n: string): string | null {
  // Extract alphanumeric codes like A4, A3, 10mm, 16mm, etc.
  const m = [...n.matchAll(/\b([A-Z]\d+|\d+[A-Z]+|\d{1,3}\s*mm)\b/gi)].map(x => x[1].toUpperCase().replace(/\s+/g, ''))
  return m.length ? m.join('-') : null
}

// Chargers — same voltage = duplicate; different voltage = different item
function isCharger(n: string) { return /\bcharger\b/i.test(n) }
function chargerVoltage(n: string): string | null {
  return n.match(/\b(\d+(?:\.\d+)?)\s*v\b/i)?.[1] ?? null
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
  if (isSlideItem(n1) && isSlideItem(n2)) {
    const c1 = slideCode(n1), c2 = slideCode(n2)
    return c1 !== null && c1 === c2
  }
  if (isCharger(n1) && isCharger(n2)) {
    const v1 = chargerVoltage(n1), v2 = chargerVoltage(n2)
    return v1 !== null && v1 === v2
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
    dupReceipts,
    unlinkedNamed,
  ] = await Promise.all([

    // 1. Walk-in customers with no cash counted
    // Walk-in receipts created through the app store customer_name as NULL --
    // "Walk-in Customer" is only a display fallback, never the literal saved
    // value. Older/imported rows may still have the literal string.
    safeQuery(() => sql`
      SELECT id, receipt_number, receipt_date::text AS receipt_date,
             customer_name, total AS invoice_amount
      FROM sales_receipts
      WHERE (customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer')
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

    // 7. Days with a sales receipt but no staff times entered at all
    safeQuery(() => sql`
      SELECT DISTINCT receipt_date::date::text AS missing_date
      FROM sales_receipts sr
      WHERE sr.receipt_date::date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1 FROM staff_times st
          WHERE st.work_date = sr.receipt_date::date
        )
      ORDER BY missing_date DESC
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

    // 9. Dates with more than one receipt for the same customer type (WIC or GMC)
    safeQuery(() => sql`
      SELECT
        receipt_date::text AS receipt_date,
        CASE WHEN customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END AS customer_type,
        COUNT(*) AS receipt_count,
        STRING_AGG(receipt_number, ', ' ORDER BY receipt_number) AS receipt_numbers,
        STRING_AGG(id::text, ',' ORDER BY id) AS receipt_ids
      FROM sales_receipts
      GROUP BY receipt_date::date, CASE WHEN customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END
      HAVING COUNT(*) > 1
      ORDER BY receipt_date DESC
    `),

    // 10. Sales lines whose name matches an active item by text but were never
    // actually linked to it (item_id is null) -- usually from hand-editing a
    // line's name to the right text without re-picking the item. These pass
    // the #5 "not in inventory" check since that only compares names, so this
    // is the only place they surface; the quantity/revenue on these lines is
    // silently missing from that item's own activity until linked.
    safeQuery(() => sql`
      SELECT COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name, i.id AS item_id,
             COUNT(*)::int AS line_count
      FROM sales_receipt_lines srl
      JOIN items i ON LOWER(i.canonical_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name))
      WHERE srl.item_id IS NULL AND LOWER(i.status) = 'active'
      GROUP BY COALESCE(srl.resolved_name, srl.raw_item_name), i.id
      ORDER BY item_name
    `),
  ])

  const filteredDups = duplicates.filter((r: any) => shouldKeepPair(r.name1, r.name2))

  const groupNames = await safeQuery(() => sql`
    SELECT DISTINCT TRIM(cf_group) AS group_name
    FROM items
    WHERE cf_group IS NOT NULL AND TRIM(cf_group) <> ''
    ORDER BY group_name
  `)

  // 11. Items/services with no audio advert recorded (Grony Manage > Advert > Audio's own rule)
  await ensureAdvertStatusTable()
  const noAdvert = await safeQuery(() => sql`
    SELECT i.id AS item_id, i.canonical_name AS item_name, COALESCE(i.product_type, 'goods') AS product_type
    FROM items i
    LEFT JOIN item_audio_advert_status s ON s.item_id = i.id AND s.has_advert = true
    WHERE LOWER(i.status) != 'inactive' AND s.item_id IS NULL
    ORDER BY i.canonical_name
  `)

  // 12/13. Audio jingle (monthly) and equipment check (Mon/Thu) -- both
  // logged through the generic manage_logs table under their own category.
  await ensureManageLogs()
  const jingleThisMonth = await safeQuery(() => sql`
    SELECT 1 FROM manage_logs
    WHERE category = 'audio_jingle' AND log_date >= DATE_TRUNC('month', CURRENT_DATE)
    LIMIT 1
  `)
  const jingleOverdue = jingleThisMonth.length === 0
    ? [{ month: new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }]
    : []

  const dueDate = lastRequiredEquipmentCheckDate()
  const [lastEquipmentCheck] = await safeQuery(() => sql`
    SELECT MAX(log_date)::text AS d FROM manage_logs WHERE category = 'audio_equipment_check'
  `, [{ d: null }])
  const equipmentCheckOverdue = (!lastEquipmentCheck?.d || lastEquipmentCheck.d < dueDate)
    ? [{ due_date: dueDate }]
    : []

  // 14. Days with staff actually present (and sales) but no closing report --
  // the Closer's mandatory task got skipped that day. Only past days count;
  // today's closer hasn't necessarily clocked out yet.
  await ensureClosingReports()
  const missingClosingReports = await safeQuery(() => sql`
    SELECT DISTINCT sr.receipt_date::date::text AS missing_date
    FROM sales_receipts sr
    WHERE sr.receipt_date::date < CURRENT_DATE
      AND EXISTS (SELECT 1 FROM staff_times st WHERE st.work_date = sr.receipt_date::date)
      AND NOT EXISTS (SELECT 1 FROM closing_reports cr WHERE cr.work_date = sr.receipt_date::date)
    ORDER BY missing_date DESC
  `)

  return NextResponse.json({
    noCash, missingDays, duplicates: filteredDups, costGteSell, notInInventory, noGroup, noStaffTimes,
    uncheckedCab, dupReceipts, unlinkedNamed, groupNames: groupNames.map((r: any) => r.group_name),
    noAdvert, jingleOverdue, equipmentCheckOverdue, missingClosingReports,
  })
}
