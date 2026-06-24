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
             COALESCE(i.selling_price, 0) AS selling_price
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE LOWER(i.status) NOT IN ('inactive','service')
      ORDER BY i.canonical_name
    `
    return NextResponse.json(rows)
  } catch {
    // Fallback: no stock join, in case item_stock_summary view doesn't exist
    const rows = await sql`
      SELECT id, canonical_name AS name, cf_group AS "group",
             0 AS soh,
             COALESCE(selling_price, 0) AS selling_price
      FROM items
      WHERE LOWER(status) NOT IN ('inactive','service')
      ORDER BY canonical_name
    `
    return NextResponse.json(rows)
  }
}
