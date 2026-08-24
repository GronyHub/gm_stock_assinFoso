import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

export async function GET() {
  const [unmatched, matched, items] = await Promise.all([
    sql`
      SELECT
        COALESCE(resolved_name, raw_item_name) AS name,
        COUNT(*)::int AS line_count
      FROM sales_receipt_lines
      WHERE NOT EXISTS (
        SELECT 1 FROM items i
        WHERE LOWER(i.canonical_name) = LOWER(COALESCE(resolved_name, raw_item_name))
      )
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT
        COALESCE(srl.resolved_name, srl.raw_item_name) AS name,
        i.canonical_name,
        COUNT(*)::int AS line_count
      FROM sales_receipt_lines srl
      JOIN items i ON LOWER(i.canonical_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name))
      GROUP BY 1, 2
      ORDER BY 1
    `,
    sql`
      SELECT id, canonical_name
      FROM items
      WHERE LOWER(status) = 'active'
      ORDER BY canonical_name
    `,
  ])
  return success({ unmatched, matched, items })
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { raw_name, item_id, canonical_name } = await req.json()
  if (!raw_name || !item_id || !canonical_name) {
    return badRequest('Missing fields')
  }

  await sql`
    UPDATE sales_receipt_lines
    SET resolved_name = ${canonical_name}, item_id = ${item_id}
    WHERE LOWER(COALESCE(resolved_name, raw_item_name)) = LOWER(${raw_name})
  `

  return success({ ok: true })
}
