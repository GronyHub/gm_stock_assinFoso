import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NAMES = ['A4 230g', 'A4 Brown Envelope Singles', 'Advance Ink 250ml Magenta', 'Advance Ink 250ml Light Magenta']

export async function GET() {
  const items = await sql`
    SELECT id, canonical_name, status, product_type, converts_to_item_id
    FROM items
    WHERE canonical_name = ANY(${NAMES})
  `
  const mergedAliases = await sql`
    SELECT item_id AS winner_id, alias_name
    FROM item_aliases
    WHERE alias_name = ANY(${NAMES}) AND alias_type = 'canonical' AND source = 'merge'
  `
  const winnerIds = mergedAliases.map((m: any) => m.winner_id)
  const winners = winnerIds.length
    ? await sql`SELECT id, canonical_name, status FROM items WHERE id = ANY(${winnerIds})`
    : []
  return NextResponse.json({ items, mergedAliases, winners })
}
