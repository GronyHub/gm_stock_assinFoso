import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// New items covering the remaining Pre-Zoho Bills lines with a real,
// identifiable product. C-EXV 28/33 colors each cover both the "C-EXV" and
// "CEXV" spelling variants seen on different dates (same product).
const NEW_ITEMS: { name: string; raws: string[] }[] = [
  { name: 'A4 CARDBOARD PINK', raws: ['Cardboard (Pink) – 5 = 225'] },
  { name: 'FS 4FT', raws: ['FS 4FT'] },
  { name: 'FS 3FT', raws: ['FS 3FT'] },
  { name: 'SAV 4FT', raws: ['SAV 4FT'] },
  { name: 'Dell Battery', raws: ['Dell Battery purchased from Gentle = 180'] },
  { name: 'C-EXV 28 - Cyan', raws: ['C-EXV 28 – Cyan = 380', 'CEXV 28 - Cyan = 420'] },
  { name: 'C-EXV 28 - Black', raws: ['CEXV 28 - Black = 420', 'C-EXV 28 – Black = 380'] },
  { name: 'C-EXV 28 - Yellow', raws: ['C-EXV 28 – Yellow = 380', 'CEXV 28 - Yellow = 420'] },
  { name: 'C-EXV 28 - Magenta', raws: ['CEXV 28 - Magenta = 420'] },
  { name: 'C-EXV 33 - Black', raws: ['C-EXV 33 – Black = 170', 'c-exv 33 - 1 x 150 = 150'] },
]

// Existing item -- "5FT Sticker - paper type (Light) (LF) = 830" is the
// same product as the already-cataloged Large Format 5 ft Sticker.
const EXISTING_MATCH = { itemId: 156, canonicalName: 'Large  Format 5 ft Sticker', raw: '5FT Sticker - paper type (Light) (LF) = 830' }

export async function POST() {
  const created = []
  for (const entry of NEW_ITEMS) {
    const [item] = await sql`
      INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, product_type, source)
      VALUES (${'INTERNAL_' + entry.name.trim().toUpperCase().replace(/\s+/g, '_')}, ${entry.name}, ${entry.name}, 'goods', 'internal')
      RETURNING id, canonical_name
    `
    let linesResolved = 0
    for (const raw of entry.raws) {
      await sql`
        INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
        VALUES (${item.id}, ${raw}, 'canonical', 'app_migration')
        ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
      `
      const updated = await sql`
        UPDATE bill_lines
        SET item_id = ${item.id}, resolved_name = ${entry.name}, unresolved = false
        WHERE raw_item_name = ${raw}
        RETURNING id
      `
      linesResolved += updated.length
    }
    created.push({ ...item, linesResolved })
  }

  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${EXISTING_MATCH.itemId}, ${EXISTING_MATCH.raw}, 'sr_variant', 'app_migration')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  const existingUpdated = await sql`
    UPDATE bill_lines
    SET item_id = ${EXISTING_MATCH.itemId}, resolved_name = ${EXISTING_MATCH.canonicalName}, unresolved = false
    WHERE raw_item_name = ${EXISTING_MATCH.raw}
    RETURNING id
  `

  return NextResponse.json({
    createdCount: created.length,
    created,
    existingMatchLinesResolved: existingUpdated.length,
  })
}
