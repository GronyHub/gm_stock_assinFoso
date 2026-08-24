import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT s.item_id, i.canonical_name, COUNT(*)::int AS cnt
      FROM sales_receipt_lines s
      JOIN items i ON i.id = s.item_id
      WHERE s.item_id IS NOT NULL
      GROUP BY s.item_id, i.canonical_name
      EXCEPT
      SELECT DISTINCT item_id, canonical_name, 0
      FROM item_aliases a
      JOIN items i ON i.id = a.item_id
    ` as { item_id: number; canonical_name: string; cnt: number }[]

    return success(rows)
  } catch (e) {
    return handleError('aliases/leaks', e)
  }
}
