import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  try {
    const rows = await sql`
      SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
             COALESCE(s.calculated_soh, 0) AS soh,
             COALESCE(i.selling_rate, 0) AS selling_price,
             COALESCE(i.purchase_rate, 0) AS cost_price
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.status IS NULL OR LOWER(i.status) NOT IN ('inactive','service')
      ORDER BY i.canonical_name
    `
    return NextResponse.json(rows)
  } catch {
    try {
      const rows = await sql`
        SELECT id, canonical_name AS name, cf_group AS "group",
               0 AS soh,
               COALESCE(selling_rate, 0) AS selling_price,
               COALESCE(purchase_rate, 0) AS cost_price
        FROM items
        WHERE status IS NULL OR LOWER(status) NOT IN ('inactive','service')
        ORDER BY canonical_name
      `
      return NextResponse.json(rows)
    } catch (e) {
      console.error('items/all fallback error:', e)
      return NextResponse.json([])
    }
  }
}
