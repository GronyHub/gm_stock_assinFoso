import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
    SELECT srl.raw_item_name AS name, COUNT(*)::int AS cnt,
           (ia.alias_name IS NOT NULL)::boolean AS confirmed
    FROM sales_receipt_lines srl
    LEFT JOIN item_aliases ia ON LOWER(TRIM(ia.alias_name)) = LOWER(TRIM(srl.raw_item_name))
    WHERE srl.item_id IS NULL OR srl.unresolved = true
    GROUP BY srl.raw_item_name, ia.alias_name
    ORDER BY COUNT(*) DESC
  `

  return NextResponse.json(rows)
}
