import sql from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 5000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  try {
    const rows = await sql`
      SELECT
        id,
        receipt_id,
        item_id,
        COALESCE(resolved_name, raw_item_name) AS item_name,
        quantity,
        item_price,
        item_total,
        usage_unit
      FROM sales_receipt_lines
      ORDER BY receipt_id, id
      LIMIT ${limit}
      OFFSET ${offset}
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('sales/all-lines error:', e instanceof Error ? e.message : String(e))
    return NextResponse.json([])
  }
}
