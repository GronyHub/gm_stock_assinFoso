import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-off: 22 raw names from the Pre-Zoho Sales unresolved queue with no
// existing catalog match at all (confirmed via keyword search against
// items) -- creates a new item per name (using the raw text as
// canonical_name directly), adds a self-referential canonical alias
// (matching the convention seen elsewhere for existing items), and
// resolves every matching sales_receipt_lines row to it. Excludes the
// drum-vs-cartridge (55A/12A/80A-05A/26A) and ink-brand (Ink - 100ml
// Magenta) ambiguities -- those need a human call, not a new item.
const ROWS: { raw: string; type: 'goods' | 'service' }[] = [
  { raw: '5045 drum', type: 'goods' },
  { raw: 'EPSON TANK 6 COLOURS', type: 'goods' },
  { raw: 'Lenovo Big Pin', type: 'goods' },
  { raw: '131A Colour Cartridge Magenta', type: 'goods' },
  { raw: '131A Colour Cartridge Cyan', type: 'goods' },
  { raw: '131A Colour Cartridge Black', type: 'goods' },
  { raw: '131A Colour Cartridge Yellow', type: 'goods' },
  { raw: '1730 CANON DRUMS', type: 'goods' },
  { raw: '1730 CANON BLADE', type: 'goods' },
  { raw: 'ACER  LAPTOP CHARGER', type: 'goods' },
  { raw: 'C-EXV33', type: 'goods' },
  { raw: 'Push Pins', type: 'goods' },
  { raw: 'SX TONER REFILL', type: 'goods' },
  { raw: '1750i CANON TONER CART.', type: 'goods' },
  { raw: 'HP 78A', type: 'goods' },
  { raw: 'MEMORY 4GB', type: 'goods' },
  { raw: 'MEMORY 8GB', type: 'goods' },
  { raw: 'PV-Photo Framing', type: 'service' },
  { raw: 'Toshiba battery', type: 'goods' },
  { raw: 'DV4 LAPTOP BATTERIES', type: 'goods' },
  { raw: 'HDTV CABLE', type: 'goods' },
  { raw: 'V3 CABLES', type: 'goods' },
]

export async function GET() {
  const rows = await sql`
    SELECT id, canonical_name, product_type FROM items
    WHERE canonical_name = ANY(${ROWS.map(r => r.raw)})
    ORDER BY canonical_name
  `
  return NextResponse.json({ existingCount: rows.length, rows })
}

export async function POST() {
  const results = []
  for (const r of ROWS) {
    const [item] = await sql`
      INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, product_type, source)
      VALUES (${'INTERNAL_' + r.raw.trim().toUpperCase().replace(/\s+/g, '_')}, ${r.raw}, ${r.raw}, ${r.type}, 'internal')
      RETURNING id, canonical_name, product_type
    `
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${item.id}, ${r.raw}, 'canonical', 'app_migration')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    const updated = await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${item.id}, resolved_name = ${r.raw}, unresolved = false
      WHERE raw_item_name = ${r.raw}
      RETURNING id
    `
    results.push({ ...item, linesResolved: updated.length })
  }
  return NextResponse.json({ createdCount: results.length, results })
}
