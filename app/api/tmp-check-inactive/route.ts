import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NAMES = [
  'A4 230 grams',
  'A4 Brown Envelope Sing',
  'Advance Ink 250ml - Light Magenta',
  'Advance Ink 250ml - Magenta',
]

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name = ANY(${NAMES})
    ORDER BY canonical_name
  `

  // For anything Inactive, trace one more merge hop (a winner that was
  // itself later merged away).
  const inactiveNames = (items as any[]).filter(r => r.status === 'Inactive').map(r => r.canonical_name)
  const nextHop = inactiveNames.length
    ? await sql`
        SELECT ia.alias_name AS was_named, ia.item_id AS now_winner_id, i.canonical_name AS now_winner_name, i.status AS now_winner_status
        FROM item_aliases ia
        JOIN items i ON i.id = ia.item_id
        WHERE ia.alias_name = ANY(${inactiveNames}) AND ia.alias_type = 'canonical' AND ia.source = 'merge'
      `
    : []

  return NextResponse.json({ items, nextHop })
}
