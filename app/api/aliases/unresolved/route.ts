import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT LOWER(TRIM(raw_item_name)) AS name, COUNT(*)::int AS cnt FROM (
        SELECT raw_item_name FROM bill_lines WHERE unresolved = true
        UNION ALL
        SELECT raw_item_name FROM sales_receipt_lines WHERE unresolved = true
      ) combined
      GROUP BY LOWER(TRIM(raw_item_name))
      ORDER BY cnt DESC
    `
    return success(rows)
  } catch (e) {
    return handleError('aliases/unresolved', e)
  }
}
