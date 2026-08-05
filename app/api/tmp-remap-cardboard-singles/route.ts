import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  // Same join the leaks view itself uses: item(s) whose name matches the
  // alias text but ISN'T the item the alias currently points to.
  const rows = await sql`
    SELECT a.id AS alias_id, a.alias_name, a.item_id AS current_item_id,
      i.id AS target_item_id, i.canonical_name AS target_name
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    WHERE LOWER(TRIM(a.alias_name)) = 'a4 cardboard singles'
  ` as { alias_id: number; alias_name: string; current_item_id: number; target_item_id: number; target_name: string }[]

  const results: { alias_id: number; from: number; to: number }[] = []
  for (const r of rows) {
    await sql`UPDATE item_aliases SET item_id = ${r.target_item_id} WHERE id = ${r.alias_id}`
    await sql`
      UPDATE sales_receipt_lines SET item_id = ${r.target_item_id}, resolved_name = ${r.target_name}, unresolved = false
      WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${r.alias_name}))
    `
    await sql`
      UPDATE bill_lines SET item_id = ${r.target_item_id}, resolved_name = ${r.target_name}, unresolved = false
      WHERE LOWER(TRIM(raw_item_name)) = LOWER(TRIM(${r.alias_name}))
    `
    results.push({ alias_id: r.alias_id, from: r.current_item_id, to: r.target_item_id })
  }

  return NextResponse.json({ count: results.length, results })
}
