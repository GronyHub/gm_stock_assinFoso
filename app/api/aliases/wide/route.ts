import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  // Optional ?itemId= scopes this down to one item's own row instead of the
  // whole table -- used by callers (e.g. the Live Sale grid-edit sheet) that
  // only ever need a single item's aliases, so they aren't paying for an
  // aggregate over every item+alias in the system just to open one item.
  // The unscoped default stays exactly as it was for the full alias-table
  // views (Alias Wide Table, Item 360's own relations editor).
  const itemIdParam = req.nextUrl.searchParams.get('itemId')
  const itemId = itemIdParam ? Number(itemIdParam) : null

  try {
    const rows = await sql`
      SELECT
        i.id AS item_id,
        i.canonical_name,
        i.cf_group,
        COALESCE(ARRAY_AGG(
          JSON_BUILD_OBJECT('id', a.id, 'name', a.alias_name, 'type', COALESCE(a.alias_type, 'other'))
          ORDER BY a.id DESC
        ) FILTER (WHERE a.id IS NOT NULL), ARRAY[]::json[]) AS aliases,
        COUNT(a.id)::int AS cnt
      FROM items i
      LEFT JOIN item_aliases a ON a.item_id = i.id
      WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
        AND (${itemId}::int IS NULL OR i.id = ${itemId})
      GROUP BY i.id, i.canonical_name, i.cf_group
      HAVING ${itemId}::int IS NOT NULL OR COUNT(a.id) > 0
      ORDER BY cnt DESC
    ` as unknown as { item_id: number; canonical_name: string; cf_group: string | null; aliases: { id: number; name: string; type: string }[]; cnt: number }[]

    return success(rows)
  } catch (e) {
    return handleError('aliases/wide', e)
  }
}