import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const properties = await sql`
      SELECT DISTINCT id, expense_account AS name
      FROM expenses
      WHERE is_property = true
      ORDER BY expense_account ASC
    `
    return success(properties)
  } catch (e) {
    console.error('Failed to fetch properties:', e)
    return success([])
  }
}
