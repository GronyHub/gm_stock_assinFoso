import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT
      bl.raw_item_name AS name,
      COUNT(*)::int AS cnt,
      MAX(bl.resolved_name) AS resolved_name,
      MAX(bl.item_id)::int AS item_id
    FROM bill_lines bl
    WHERE bl.source = 'zoho_historical'
      AND bl.item_id IS NOT NULL
    GROUP BY bl.raw_item_name
    ORDER BY COUNT(*) DESC
  `

  return NextResponse.json(rows)
}
