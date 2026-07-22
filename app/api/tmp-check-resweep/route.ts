import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  // Same ambiguous-name computation the resweep route uses
  const ambiguousRows = await sql`
    SELECT LOWER(TRIM(alias_name)) AS norm_name, COUNT(DISTINCT item_id)::int AS item_count,
           ARRAY_AGG(DISTINCT item_id) AS item_ids
    FROM item_aliases
    GROUP BY LOWER(TRIM(alias_name))
    HAVING COUNT(DISTINCT item_id) > 1
    ORDER BY norm_name
  ` as { norm_name: string; item_count: number; item_ids: number[] }[]
  const ambiguousNames = ambiguousRows.map(r => r.norm_name)

  // Dry-run: how many sales/bill rows would the sweep's WHERE clause match right now?
  const salesWouldMatch = await sql`
    SELECT COUNT(*)::int AS n
    FROM sales_receipt_lines s
    JOIN item_aliases a ON LOWER(TRIM(s.raw_item_name)) = LOWER(TRIM(a.alias_name))
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(a.alias_name)) <> ALL(${ambiguousNames})
      AND (s.item_id IS DISTINCT FROM a.item_id OR s.unresolved = true)
  `
  const billsWouldMatch = await sql`
    SELECT COUNT(*)::int AS n
    FROM bill_lines b
    JOIN item_aliases a ON LOWER(TRIM(b.raw_item_name)) = LOWER(TRIM(a.alias_name))
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(a.alias_name)) <> ALL(${ambiguousNames})
      AND (b.item_id IS DISTINCT FROM a.item_id OR b.unresolved = true)
  `

  // Current state of the 13 names originally found stuck
  const names13 = [
    '55A TONER CARTRIDGE', 'A4 210 GRAMS', 'A3 sticker', 'A4 Sticker',
    'A4 260 grams One Side packs', 'A4 120 grams packs', 'A3 260 grams D',
    'A4 230 (One Side)', 'Service - White envelope DL singles _for envelope printing',
    'A4 300g pack', 'A4 140 grams packs', 'Service - Online registration - School Admission',
    '83A TONER CARTRIDGE',
  ]
  const current = await sql`
    SELECT raw_item_name, COUNT(*)::int AS cnt,
           COUNT(*) FILTER (WHERE item_id IS NOT NULL AND unresolved = false)::int AS fully_resolved,
           COUNT(*) FILTER (WHERE item_id IS NULL)::int AS null_item_id,
           COUNT(*) FILTER (WHERE unresolved = true)::int AS still_unresolved_flag
    FROM sales_receipt_lines
    WHERE raw_item_name = ANY(${names13})
    GROUP BY raw_item_name
  `

  return NextResponse.json({
    ambiguousCount: ambiguousNames.length,
    ambiguousSample: ambiguousRows.slice(0, 45),
    salesWouldMatchNow: salesWouldMatch[0].n,
    billsWouldMatchNow: billsWouldMatch[0].n,
    current13: current,
  })
}
