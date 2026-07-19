import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT p.id AS pack_id, p.canonical_name AS pack_name, p.units_per_pack, p.product_type,
           p.converts_to_item_id, s.id AS singles_id, s.canonical_name AS singles_name
    FROM items p
    LEFT JOIN items s ON s.id = p.converts_to_item_id
    WHERE p.id = 28
  `
  return NextResponse.json(rows)
}
