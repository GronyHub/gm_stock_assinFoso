import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await getCached('aliases:unresolved-bills', 300, () => sql`
      SELECT LOWER(TRIM(raw_item_name)) AS name, COUNT(*)::int AS cnt
      FROM bill_lines
      WHERE unresolved = true
      GROUP BY LOWER(TRIM(raw_item_name))
      ORDER BY cnt DESC
    `)
    return success(rows)
  } catch (e) {
    return handleError('aliases/unresolved-bills', e)
  }
}
