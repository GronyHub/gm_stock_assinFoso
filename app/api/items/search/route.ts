import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const q = req.nextUrl.searchParams.get('q') || ''
  const rows = await sql`
    SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
           COALESCE(s.calculated_soh, 0) AS soh,
           COALESCE(i.selling_rate, 0) AS selling_price
    FROM items i
    LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.canonical_name ILIKE ${'%' + q + '%'}
       OR i.cf_group ILIKE ${'%' + q + '%'}
    ORDER BY i.canonical_name
    LIMIT 50
  `
  return NextResponse.json(rows)
}
