import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const TERMS = ['%A4%230g%', '%A4%Brown%Envelope%', '%Advance%Ink%250ml%Magenta%', '%Advance%Ink%250ml%Light%Magenta%']

export async function GET() {
  const fuzzy = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name ILIKE ANY(${TERMS})
    ORDER BY canonical_name
  `
  // Trace one more merge hop for anything fuzzy-matched that's Inactive
  // (a winner that was itself later merged away).
  const inactiveNames = (fuzzy as any[]).filter(r => r.status === 'Inactive').map(r => r.canonical_name)
  const nextHop = inactiveNames.length
    ? await sql`
        SELECT ia.alias_name AS was_named, ia.item_id AS now_winner_id, i.canonical_name AS now_winner_name, i.status AS now_winner_status
        FROM item_aliases ia
        JOIN items i ON i.id = ia.item_id
        WHERE ia.alias_name = ANY(${inactiveNames}) AND ia.alias_type = 'canonical' AND ia.source = 'merge'
      `
    : []
  const aliasHits = await sql`
    SELECT item_id, alias_name, alias_type, source
    FROM item_aliases
    WHERE alias_name ILIKE ANY(${TERMS})
    ORDER BY alias_name
  `
  return NextResponse.json({ fuzzy, nextHop, aliasHits })
}
