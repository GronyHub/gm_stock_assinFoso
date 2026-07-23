import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const DRUMS = ['55A HP DRUMS', '12A dRUMS', '80A/ 05A HP DRUMS', '26A HP DRUMS']

export async function GET() {
  const inkCandidates = await sql`
    SELECT id, canonical_name, status, product_type FROM items
    WHERE canonical_name = 'Advance Ink 100ml - Magenta'
    ORDER BY id
  `
  const existingDrums = await sql`
    SELECT id, canonical_name FROM items WHERE canonical_name = ANY(${DRUMS})
  `
  return NextResponse.json({ inkCandidates, existingDrums })
}

export async function POST() {
  const results = []
  for (const raw of DRUMS) {
    const [item] = await sql`
      INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, product_type, source)
      VALUES (${'INTERNAL_' + raw.trim().toUpperCase().replace(/\s+/g, '_')}, ${raw}, ${raw}, 'goods', 'internal')
      RETURNING id, canonical_name
    `
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${item.id}, ${raw}, 'canonical', 'app_migration')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    const updated = await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item.id}, resolved_name = ${raw}, unresolved = false
      WHERE raw_item_name = ${raw}
      RETURNING id
    `
    results.push({ ...item, linesResolved: updated.length })
  }
  return NextResponse.json({ createdCount: results.length, results })
}
