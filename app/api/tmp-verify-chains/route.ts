import sql from '@/lib/db'
import { NextResponse } from 'next/server'
import { PACK_PAIRING_CHAINS } from '@/lib/stockGuard'
import { DAILY_ITEM_IDS } from '@/lib/countRules'

export async function GET() {
  const nameMatches = await sql`
    SELECT id, canonical_name, converts_to_item_id, units_per_pack, product_type
    FROM items
    WHERE canonical_name ILIKE '%envelope%' OR canonical_name ILIKE '%env%'
       OR canonical_name ILIKE '%lamination%' OR canonical_name ILIKE '%sheet%'
       OR canonical_name ILIKE '%5x7%' OR canonical_name ILIKE '%4x6%'
       OR canonical_name ILIKE '%cardboard%'
    ORDER BY canonical_name
  ` as { id: number; canonical_name: string; converts_to_item_id: number | null; units_per_pack: string | null; product_type: string | null }[]

  const dailyItems = await sql`
    SELECT id, canonical_name, converts_to_item_id, product_type
    FROM items WHERE id = ANY(${DAILY_ITEM_IDS})
    ORDER BY id
  ` as { id: number; canonical_name: string; converts_to_item_id: number | null; product_type: string | null }[]

  const chainMatchReport = nameMatches.map(r => ({
    id: r.id,
    name: r.canonical_name,
    converts_to_item_id: r.converts_to_item_id,
    matchingChains: PACK_PAIRING_CHAINS.filter(c => c.match.test(r.canonical_name)).map(c => c.match.source),
  }))

  const dailyIdReport = dailyItems.map(r => ({
    id: r.id,
    name: r.canonical_name,
    matchingChains: PACK_PAIRING_CHAINS.filter(c => c.match.test(r.canonical_name)).map(c => c.match.source),
  }))

  const packsPointingAtDaily = await sql`
    SELECT id, canonical_name, converts_to_item_id FROM items
    WHERE converts_to_item_id = ANY(${DAILY_ITEM_IDS})
    ORDER BY converts_to_item_id
  `

  return NextResponse.json({ nameMatches: chainMatchReport, dailyItems: dailyIdReport, packsPointingAtDaily })
}
