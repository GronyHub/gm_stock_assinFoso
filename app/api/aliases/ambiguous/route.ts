import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Alias names that resolve to more than one item -- the exact class of
// thing lib/aliases/resweep skips rather than guess at (see the resweep
// route's own comment). Surfacing them here is what makes that skip list
// reviewable instead of just silently smaller each sweep.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const aliasRows = await sql`
    WITH ambiguous_names AS (
      SELECT LOWER(TRIM(alias_name)) AS norm_name
      FROM item_aliases
      GROUP BY LOWER(TRIM(alias_name))
      HAVING COUNT(DISTINCT item_id) > 1
    )
    SELECT a.id AS alias_id, LOWER(TRIM(a.alias_name)) AS norm_name, a.alias_name,
           a.item_id, i.canonical_name, a.alias_type, a.source
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    JOIN ambiguous_names an ON an.norm_name = LOWER(TRIM(a.alias_name))
    ORDER BY an.norm_name, a.item_id
  ` as { alias_id: number; norm_name: string; alias_name: string; item_id: number; canonical_name: string; alias_type: string; source: string }[]

  const salesCounts = await sql`
    SELECT LOWER(TRIM(raw_item_name)) AS norm_name, item_id, COUNT(*)::int AS cnt
    FROM sales_receipt_lines
    WHERE item_id IS NOT NULL
    GROUP BY LOWER(TRIM(raw_item_name)), item_id
  ` as { norm_name: string; item_id: number; cnt: number }[]
  const billCounts = await sql`
    SELECT LOWER(TRIM(raw_item_name)) AS norm_name, item_id, COUNT(*)::int AS cnt
    FROM bill_lines
    WHERE item_id IS NOT NULL
    GROUP BY LOWER(TRIM(raw_item_name)), item_id
  ` as { norm_name: string; item_id: number; cnt: number }[]

  const countKey = (n: string, id: number) => `${n}::${id}`
  const lineCounts = new Map<string, number>()
  for (const r of [...salesCounts, ...billCounts]) {
    const k = countKey(r.norm_name, r.item_id)
    lineCounts.set(k, (lineCounts.get(k) ?? 0) + r.cnt)
  }

  type Candidate = { alias_id: number; alias_name: string; item_id: number; canonical_name: string; alias_type: string; source: string; line_count: number }
  const groups = new Map<string, { norm_name: string; candidates: Candidate[] }>()
  for (const r of aliasRows) {
    if (!groups.has(r.norm_name)) groups.set(r.norm_name, { norm_name: r.norm_name, candidates: [] })
    groups.get(r.norm_name)!.candidates.push({
      alias_id: r.alias_id,
      alias_name: r.alias_name,
      item_id: r.item_id,
      canonical_name: r.canonical_name,
      alias_type: r.alias_type,
      source: r.source,
      line_count: lineCounts.get(countKey(r.norm_name, r.item_id)) ?? 0,
    })
  }

  return NextResponse.json(Array.from(groups.values()))
}
