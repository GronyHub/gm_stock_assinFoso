import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const chains = await sql`
    SELECT p.item_id AS pack_id, p.item_name AS pack_name, p.units_per_pack,
           s.item_id AS singles_id, s.item_name AS singles_name
    FROM items p
    JOIN items s ON s.item_id = p.converts_to_item_id
    ORDER BY p.item_name
  `
  const candidates = await sql`
    SELECT item_id, item_name, product_type, converts_to_item_id, units_per_pack
    FROM items
    WHERE item_name ILIKE '%A4%Sheet%' OR item_name ILIKE '%A4%Lamina%'
    ORDER BY item_name
  `
  return NextResponse.json({ chains, candidates })
}
