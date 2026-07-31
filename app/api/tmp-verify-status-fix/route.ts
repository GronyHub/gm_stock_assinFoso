import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT i.id, i.canonical_name AS item_name,
             COALESCE(i.cf_group, s.cf_group) AS cf_group,
             COALESCE(s.calculated_soh, 0) AS calculated_soh
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.status IS NULL OR LOWER(i.status) != 'inactive'
      ORDER BY cf_group NULLS LAST, i.canonical_name
    `
    const match = rows.filter(r => String(r.item_name).toLowerCase().includes('4x6'))
    return NextResponse.json({ totalCount: rows.length, match })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
