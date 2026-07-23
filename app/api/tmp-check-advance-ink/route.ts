import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-off: reactivate id 265 ("Advance Ink 100ml - Magenta", the one with
// real aliases/history), add the missing "Ink - 100ml Magenta" alias
// (matching the sibling colors' established "Ink - 100ml <Color>" naming),
// and resolve the pending sales line to it. id 76 (the empty duplicate) is
// deliberately left untouched.
export async function POST() {
  const [reactivated] = await sql`
    UPDATE items SET status = 'Active' WHERE id = 265
    RETURNING id, canonical_name, status
  `
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (265, 'Ink - 100ml Magenta', 'canonical', 'app_migration')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  const updated = await sql`
    UPDATE sales_receipt_lines
    SET item_id = 265, resolved_name = 'Advance Ink 100ml - Magenta', unresolved = false
    WHERE raw_item_name = 'Ink - 100ml Magenta'
    RETURNING id
  `
  return NextResponse.json({ reactivated, linesResolved: updated.length })
}

export async function GET() {
  const rows = await sql`
    SELECT id, canonical_name, status, selling_rate, purchase_rate, cf_group
    FROM items
    WHERE canonical_name ILIKE '%advance ink 100ml%'
    ORDER BY canonical_name, id
  `
  const aliases = await sql`
    SELECT a.item_id, i.canonical_name AS owner_name, i.status AS owner_status,
           a.alias_name, a.alias_type
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE i.canonical_name ILIKE '%advance ink 100ml%'
    ORDER BY a.item_id, a.id
  `
  return NextResponse.json({ count: rows.length, rows, aliases })
}
