import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const chains = await sql`
    SELECT p.id AS pack_id, p.canonical_name AS pack_name, p.units_per_pack,
           s.id AS singles_id, s.canonical_name AS singles_name
    FROM items p
    JOIN items s ON s.id = p.converts_to_item_id
    ORDER BY p.canonical_name
  `
  const candidates = await sql`
    SELECT id, canonical_name, product_type, converts_to_item_id, units_per_pack
    FROM items
    WHERE canonical_name ILIKE '%A4%Sheet%' OR canonical_name ILIKE '%A4%Lamina%'
    ORDER BY canonical_name
  `
  return NextResponse.json({ chains, candidates })
}
