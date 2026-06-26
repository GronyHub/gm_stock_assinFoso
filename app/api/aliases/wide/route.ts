import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  // All aliases grouped by canonical item, ordered by canonical name
  const rows = await sql`
    SELECT
      i.id AS item_id,
      i.canonical_name,
      i.cf_group,
      ARRAY_AGG(a.alias_name ORDER BY a.alias_type, a.alias_name) AS aliases
    FROM items i
    JOIN item_aliases a ON a.item_id = i.id
    WHERE LOWER(i.status) NOT IN ('inactive')
    GROUP BY i.id, i.canonical_name, i.cf_group
    ORDER BY i.cf_group NULLS LAST, i.canonical_name
  `

  return NextResponse.json(rows)
}
