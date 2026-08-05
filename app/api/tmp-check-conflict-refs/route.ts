import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  // Every table/column in the live schema that could hold a reference to
  // items.id -- broader net than just item_id, since some tables might use
  // a different column name.
  const cols = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE column_name ILIKE '%item_id%'
    ORDER BY table_name
  ` as { table_name: string; column_name: string }[]

  const leaks = await sql`
    SELECT DISTINCT ON (LOWER(TRIM(a.alias_name)), i.id)
      a.id AS alias_id, a.alias_name,
      a.item_id AS aliased_to_item_id, ai.canonical_name AS aliased_to_item_name,
      i.id AS conflicting_item_id, i.canonical_name AS conflicting_item_name, i.status AS conflicting_item_status
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    JOIN items ai ON ai.id = a.item_id
    ORDER BY LOWER(TRIM(a.alias_name)), i.id, a.id
  ` as { alias_id: number; alias_name: string; aliased_to_item_id: number; aliased_to_item_name: string; conflicting_item_id: number; conflicting_item_name: string; conflicting_item_status: string | null }[]

  const conflictingIds = Array.from(new Set(leaks.map(r => r.conflicting_item_id)))

  // Count references in every table/column found above, for each conflicting item id
  const refCounts: Record<number, Record<string, number>> = {}
  for (const id of conflictingIds) refCounts[id] = {}

  for (const c of cols) {
    // Skip the items table itself and item_aliases (already accounted for)
    if (c.table_name === 'items') continue
    try {
      const rows = await sql`
        SELECT ${sql.unsafe(c.column_name)} AS item_id, COUNT(*)::int AS cnt
        FROM ${sql.unsafe(c.table_name)}
        WHERE ${sql.unsafe(c.column_name)} = ANY(${conflictingIds})
        GROUP BY ${sql.unsafe(c.column_name)}
      ` as { item_id: number; cnt: number }[]
      for (const r of rows) {
        refCounts[r.item_id][`${c.table_name}.${c.column_name}`] = r.cnt
      }
    } catch {
      // column might not actually be int/comparable, skip
    }
  }

  const summary = leaks
    .filter(r => r.conflicting_item_status !== 'Active')
    .map(r => ({
      alias_name: r.alias_name,
      aliased_to: r.aliased_to_item_name,
      conflicting_item_id: r.conflicting_item_id,
      conflicting_item_name: r.conflicting_item_name,
      conflicting_item_status: r.conflicting_item_status,
      references: refCounts[r.conflicting_item_id],
      totalRefs: Object.values(refCounts[r.conflicting_item_id]).reduce((s, n) => s + n, 0),
    }))

  return NextResponse.json({
    columnsFound: cols,
    totalLeaks: leaks.length,
    nonActiveLeaks: summary.length,
    summary,
  })
}
