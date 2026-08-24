import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    // Fetch items with their aliases, including full alias details (name and type)
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
      WHERE i.status IS NULL OR LOWER(i.status) <> 'inactive'
      GROUP BY i.id, i.canonical_name, i.cf_group
      HAVING COUNT(a.id) > 0
      ORDER BY cnt DESC
    ` as unknown as { item_id: number; canonical_name: string; cf_group: string | null; aliases: { id: number; name: string; type: string }[]; cnt: number }[]

    return success(rows)
  } catch (e) {
    return handleError('aliases/wide', e)
  }
}