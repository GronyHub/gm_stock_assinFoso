import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT
      i.id AS item_id,
      i.canonical_name,
      i.cf_group,
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT('id', a.id, 'name', a.alias_name, 'type', a.alias_type)
          ORDER BY a.alias_type, a.alias_name
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'
      ) AS aliases
    FROM items i
    LEFT JOIN item_aliases a ON a.item_id = i.id
    WHERE LOWER(i.status) NOT IN ('inactive')
    GROUP BY i.id, i.canonical_name, i.cf_group
    ORDER BY i.cf_group NULLS LAST, i.canonical_name
  `

  return NextResponse.json(rows)
}
