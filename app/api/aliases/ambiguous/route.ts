import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDismissedAliasReviews } from '@/lib/dismissedAliasReviews'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureDismissedAliasReviews()

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
      WHERE NOT EXISTS (
        SELECT 1 FROM dismissed_alias_reviews d
        WHERE d.review_type = 'ambiguous' AND d.review_key = an.norm_name
      )
      ORDER BY an.norm_name, a.item_id
    ` as { alias_id: number; norm_name: string; alias_name: string; item_id: number; canonical_name: string; alias_type: string; source: string }[]

    const lineCounts = await sql`
      SELECT LOWER(TRIM(raw_item_name)) AS norm_name, item_id, COUNT(*)::int AS cnt
      FROM sales_receipt_lines
      WHERE item_id IS NOT NULL
      GROUP BY LOWER(TRIM(raw_item_name)), item_id
      UNION ALL
      SELECT LOWER(TRIM(raw_item_name)) AS norm_name, item_id, COUNT(*)::int AS cnt
      FROM bill_lines
      WHERE item_id IS NOT NULL
      GROUP BY LOWER(TRIM(raw_item_name)), item_id
    ` as { norm_name: string; item_id: number; cnt: number }[]

    const countKey = (n: string, id: number) => `${n}::${id}`
    const lineCountMap = new Map<string, number>()
    for (const r of lineCounts) {
      const k = countKey(r.norm_name, r.item_id)
      lineCountMap.set(k, (lineCountMap.get(k) ?? 0) + r.cnt)
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
        line_count: lineCountMap.get(countKey(r.norm_name, r.item_id)) ?? 0,
      })
    }

    return success(Array.from(groups.values()))
  } catch (e) {
    return handleError('aliases/ambiguous', e)
  }
}
