import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT item_id, canonical_name, ARRAY_AGG(DISTINCT alias_name) AS alias_names, COUNT(*)::int AS cnt
      FROM (
        SELECT i.id AS item_id, i.canonical_name, a.alias_name
        FROM items i
        JOIN item_aliases a ON a.item_id = i.id
        WHERE i.status IS NULL OR LOWER(i.status) <> 'inactive'
      ) active
      GROUP BY item_id, canonical_name
      HAVING COUNT(*) > 1
      ORDER BY cnt DESC
    ` as { item_id: number; canonical_name: string; alias_names: string[]; cnt: number }[]

    return success(rows)
  } catch (e) {
    return handleError('aliases/wide', e)
  }
}
