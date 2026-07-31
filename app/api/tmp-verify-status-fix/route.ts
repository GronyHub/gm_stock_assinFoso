import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
           COALESCE(s.calculated_soh, 0) AS soh,
           COALESCE(i.selling_rate, 0) AS selling_price
    FROM items i
    LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.status IS NULL OR LOWER(i.status) != 'inactive'
    ORDER BY cf_group NULLS LAST, i.canonical_name
  `
  const match = rows.filter(r => String(r.name).toLowerCase().includes('4x6'))
  return NextResponse.json({ totalCount: rows.length, match })
}
