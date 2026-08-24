import { success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const after = req.nextUrl.searchParams.get('after')

  if (after) {
    const rows = await sql`
      SELECT id, staff_name, action, details, created_at
      FROM activity_logs
      WHERE id > ${Number(after)}
      ORDER BY id ASC
      LIMIT 50
    `
    return success(rows)
  }

  const rows = await sql`
    SELECT id, staff_name, action, details, created_at
    FROM activity_logs
    ORDER BY id DESC
    LIMIT 1
  `
  return success(rows)
}
