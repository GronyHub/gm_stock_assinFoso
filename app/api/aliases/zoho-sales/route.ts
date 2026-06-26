import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT
      srl.raw_item_name AS name,
      COUNT(*)::int AS cnt,
      MAX(srl.resolved_name) AS resolved_name,
      MAX(srl.item_id)::int AS item_id
    FROM sales_receipt_lines srl
    WHERE srl.source = 'zoho_historical'
      AND srl.item_id IS NOT NULL
    GROUP BY srl.raw_item_name
    ORDER BY COUNT(*) DESC
  `

  return NextResponse.json(rows)
}
