import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

// Only the 6 price-confirmed pack-vs-singles/A3-vs-A4 mismatches -- NOT
// "A4 CARDBOARD SINGLES" (target item has broken CP>SP pricing, needs its
// own fix first) or "A4 Lamination Singles" (looks like a duplicate-item
// situation, not a simple wrong-alias one -- both sides price identically).
const ONLY_NAMES = ['A3 210 grams', 'BLUE CARDBOARD', 'GREEN CARDBOARD', 'PINK CARDBOARD', 'YELLOW CARDBOARD', 'A4 LAMINATION']

export async function POST() {
  const leaks = await sql`
    SELECT DISTINCT ON (LOWER(TRIM(a.alias_name)), i.id)
      a.id AS alias_id, a.alias_name,
      a.item_id AS aliased_to_item_id,
      i.id AS conflicting_item_id, i.canonical_name AS conflicting_item_name
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    WHERE NOT EXISTS (
      SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text
    )
    AND LOWER(TRIM(a.alias_name)) = ANY(${ONLY_NAMES.map(n => n.toLowerCase().trim())})
    ORDER BY LOWER(TRIM(a.alias_name)), i.id, a.id
  ` as { alias_id: number; alias_name: string; aliased_to_item_id: number; conflicting_item_id: number; conflicting_item_name: string }[]

  const results: { alias_name: string; from: number; to: number; warning: string | null }[] = []

  for (const row of leaks) {
    const warning = aliasMismatchWarning(row.alias_name, row.conflicting_item_name)

    await sql`UPDATE item_aliases SET item_id = ${row.conflicting_item_id} WHERE id = ${row.alias_id}`

    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${row.conflicting_item_id}, resolved_name = ${row.conflicting_item_name}, unresolved = false
      WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${row.alias_name}))
    `
    await sql`
      UPDATE bill_lines
      SET item_id = ${row.conflicting_item_id}, resolved_name = ${row.conflicting_item_name}, unresolved = false
      WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${row.alias_name}))
    `

    results.push({ alias_name: row.alias_name, from: row.aliased_to_item_id, to: row.conflicting_item_id, warning })
  }

  return NextResponse.json({ count: results.length, results })
}
