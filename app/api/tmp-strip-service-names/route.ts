import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Renames the 10 non-colliding "service-X" items to just "X", using the
// exact same rename logic /api/items/[id]'s PUT uses (preserve old name as
// an alias, backfill resolved_name/item_name everywhere it's cached) --
// item 353 (service-A4 sticker -> A4 sticker) is deliberately excluded, it
// collides with existing item 13 "A4 STICKER".
const RENAMES: { id: number; newName: string }[] = [
  { id: 344, newName: 'light bill' },
  { id: 346, newName: '4ft sticker' },
  { id: 322, newName: 'A3 lamination singles for sale' },
  { id: 348, newName: 'A4 260 singles' },
  { id: 349, newName: 'A4 photopaper printing' },
  { id: 345, newName: 'ID lamination' },
  { id: 352, newName: 'cardbard white singles' },
  { id: 341, newName: 'certificate printing' },
  { id: 343, newName: 'dues book' },
  { id: 339, newName: 'photo taken' },
]

export async function POST() {
  const results = []
  for (const { id, newName } of RENAMES) {
    const [current] = await sql`SELECT canonical_name FROM items WHERE id = ${id}`
    if (!current) { results.push({ id, ok: false, error: 'not found' }); continue }
    if (current.canonical_name === newName) { results.push({ id, ok: true, skipped: true }); continue }

    await sql`
      UPDATE items SET canonical_name = ${newName}, zoho_item_name = ${newName}
      WHERE id = ${id}
    `
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${id}, ${current.canonical_name}, 'canonical', 'rename')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    await sql`UPDATE sales_receipt_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
    await sql`UPDATE bill_lines SET resolved_name = ${newName} WHERE item_id = ${id}`
    await sql`UPDATE stock_counts SET item_name = ${newName} WHERE item_id = ${id}`
    results.push({ id, ok: true, from: current.canonical_name, to: newName })
  }
  return NextResponse.json({ results })
}
