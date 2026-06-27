import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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
    return NextResponse.json(rows)
  }

  // No baseline yet -- just return the latest row so the client can seed
  // its "last seen" id without showing a toast for old history.
  const rows = await sql`
    SELECT id, staff_name, action, details, created_at
    FROM activity_logs
    ORDER BY id DESC
    LIMIT 1
  `
  return NextResponse.json(rows)
}
