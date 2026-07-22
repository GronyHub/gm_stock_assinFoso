import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ILIKE '%4x6%passport%' OR canonical_name ILIKE '%passport%4x6%'
       OR canonical_name ILIKE '%4x6%for passport%'
    ORDER BY id
  `
  const aliases = await sql`
    SELECT a.id, a.item_id, i.canonical_name AS owner_name, i.status AS owner_status,
           a.alias_name, a.alias_type, a.source
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE a.alias_name ILIKE '%4x6%passport%' OR a.alias_name ILIKE '%passport%4x6%'
    ORDER BY a.id
  `
  return NextResponse.json({ items, aliases })
}
