import sql from '@/lib/db'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 1000, 5000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
  const since = url.searchParams.get('since')

  const rows = await sql`
    SELECT
      bill_id,
      item_id,
      COALESCE(resolved_name, raw_item_name) AS item_name,
      quantity,
      unit_price,
      item_total,
      usage_unit,
      COALESCE(unresolved, false) AS unresolved
    FROM bill_lines
    ORDER BY bill_id, id
    LIMIT ${limit}
    OFFSET ${offset}
  `
  return NextResponse.json(rows)
}
