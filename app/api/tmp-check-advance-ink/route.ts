import sql from '@/lib/db'
import { NextResponse } from 'next/server'

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
