import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NAMES = ['a4 cardboard singles', 'a4 lamination singles']

export async function POST() {
  // Find the correct target (the conflicting item) for each name, fresh.
  const targets = await sql`
    SELECT DISTINCT ON (LOWER(TRIM(i.canonical_name)))
      i.id AS item_id, i.canonical_name
    FROM items i
    WHERE LOWER(TRIM(i.canonical_name)) = ANY(${NAMES})
    ORDER BY LOWER(TRIM(i.canonical_name)), i.id
  ` as { item_id: number; canonical_name: string }[]

  const results: { alias_id: number; alias_name: string; from: number; to: number }[] = []

  for (const t of targets) {
    // Every alias row (not just one) sharing this normalized text, so no
    // sibling gets missed like last time.
    const siblings = await sql`
      SELECT id, alias_name, item_id FROM item_aliases
      WHERE LOWER(TRIM(alias_name)) = LOWER(TRIM(${t.canonical_name})) AND item_id != ${t.item_id}
    ` as { id: number; alias_name: string; item_id: number }[]

    for (const s of siblings) {
      await sql`UPDATE item_aliases SET item_id = ${t.item_id} WHERE id = ${s.id}`
      await sql`
        UPDATE sales_receipt_lines SET item_id = ${t.item_id}, resolved_name = ${t.canonical_name}, unresolved = false
        WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${s.alias_name}))
      `
      await sql`
        UPDATE bill_lines SET item_id = ${t.item_id}, resolved_name = ${t.canonical_name}, unresolved = false
        WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${s.alias_name}))
      `
      results.push({ alias_id: s.id, alias_name: s.alias_name, from: s.item_id, to: t.item_id })
    }
  }

  return NextResponse.json({ count: results.length, results })
}
