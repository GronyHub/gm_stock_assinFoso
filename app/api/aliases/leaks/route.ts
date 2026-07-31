import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// Alias text that also exists as a *different* item's own canonical name --
// the alias is "leaking" a name that collides with a real, separate item,
// which is exactly the kind of near-duplicate that confuses search/lists.
// One row per (alias_name, conflicting item) pair even if several alias
// rows (canonical/sr_variant/etc, from different import sources) share the
// same text -- the reviewer only needs to see the conflict once.
export async function GET() {
  const rows = await sql`
    SELECT DISTINCT ON (LOWER(TRIM(a.alias_name)), i.id)
      a.id AS alias_id, a.alias_name, a.alias_type, a.source AS alias_source,
      a.item_id AS aliased_to_item_id, ai.canonical_name AS aliased_to_item_name,
      i.id AS conflicting_item_id, i.canonical_name AS conflicting_item_name, i.status AS conflicting_item_status
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    JOIN items ai ON ai.id = a.item_id
    ORDER BY LOWER(TRIM(a.alias_name)), i.id, a.id
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alias_id } = await req.json()
  if (!alias_id) return NextResponse.json({ error: 'alias_id required' }, { status: 400 })

  await sql`DELETE FROM item_aliases WHERE id = ${alias_id}`
  return NextResponse.json({ ok: true })
}
