import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  await sql`
    CREATE TABLE IF NOT EXISTS dismissed_alias_reviews (
      review_type TEXT NOT NULL, review_key TEXT NOT NULL, dismissed_by TEXT,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (review_type, review_key)
    )
  `.catch(() => {})

  const [conflict] = await sql`
    SELECT a.id AS alias_id, a.alias_name
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    LIMIT 1
  `
  if (!conflict) return NextResponse.json({ note: 'no name-conflict rows exist to test with' })

  const key = String(conflict.alias_id)
  const before = await sql`SELECT COUNT(*)::int AS n FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    WHERE a.id = ${conflict.alias_id}
      AND NOT EXISTS (SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text)`

  await sql`INSERT INTO dismissed_alias_reviews (review_type, review_key, dismissed_by) VALUES ('name_conflict', ${key}, 'diagnostic') ON CONFLICT DO NOTHING`

  const afterDismiss = await sql`SELECT COUNT(*)::int AS n FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    WHERE a.id = ${conflict.alias_id}
      AND NOT EXISTS (SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text)`

  await sql`DELETE FROM dismissed_alias_reviews WHERE review_type = 'name_conflict' AND review_key = ${key}`

  const afterRevert = await sql`SELECT COUNT(*)::int AS n FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    WHERE a.id = ${conflict.alias_id}
      AND NOT EXISTS (SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text)`

  return NextResponse.json({
    testedAlias: conflict.alias_name,
    visibleBeforeDismiss: before[0].n,
    visibleAfterDismiss: afterDismiss[0].n,
    visibleAfterRevert: afterRevert[0].n,
  })
}
