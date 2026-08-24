import { success } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const rows = await sql`
    SELECT id, staff_name, action, details, created_at
    FROM activity_logs
    ORDER BY created_at DESC
    LIMIT 500
  `
  return success(rows)
}
