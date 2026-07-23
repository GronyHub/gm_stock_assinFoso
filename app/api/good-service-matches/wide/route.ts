import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One row per item (mirrors /api/aliases/wide's shape), with its matched
// counterparts aggregated -- a good's matches are services, a service's
// matches are goods, direction inferred from product_type same as the
// inline MatchPicker in the item edit form. good_service_matches stores
// pairs by name (not item_id), so the join happens here in JS rather than
// SQL -- match volume is small enough that this is simpler than a
// case-direction SQL join.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const [items, pairs] = await Promise.all([
    sql`
      SELECT id AS item_id, canonical_name, cf_group, COALESCE(product_type, 'goods') AS product_type
      FROM items
      WHERE status IS NULL OR LOWER(status) NOT IN ('inactive')
      ORDER BY cf_group NULLS LAST, canonical_name
    `,
    sql`SELECT id, good_name, service_name FROM good_service_matches`,
  ])

  const byGood = new Map<string, { id: number; name: string }[]>()
  const byService = new Map<string, { id: number; name: string }[]>()
  for (const p of pairs as { id: number; good_name: string; service_name: string }[]) {
    const g = p.good_name.trim().toLowerCase()
    const s = p.service_name.trim().toLowerCase()
    if (!byGood.has(g)) byGood.set(g, [])
    byGood.get(g)!.push({ id: p.id, name: p.service_name })
    if (!byService.has(s)) byService.set(s, [])
    byService.get(s)!.push({ id: p.id, name: p.good_name })
  }

  const rows = (items as { item_id: number; canonical_name: string; cf_group: string | null; product_type: string }[]).map(i => {
    const key = i.canonical_name.trim().toLowerCase()
    const matches = i.product_type === 'service' ? (byService.get(key) ?? []) : (byGood.get(key) ?? [])
    return { item_id: i.item_id, canonical_name: i.canonical_name, cf_group: i.cf_group, product_type: i.product_type, matches }
  })

  return NextResponse.json(rows)
}
