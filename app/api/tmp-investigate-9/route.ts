import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const IDS = [276, 273, 371, 267, 76, 82, 81, 205, 117]

export async function GET() {
  const out: Record<string, unknown> = {}

  for (const id of IDS) {
    const [item] = await sql`SELECT id, canonical_name, cf_group, status FROM items WHERE id = ${id}`
    if (!item) { out[id] = { error: 'not found' }; continue }

    const [[sales], [bills], [counts]] = await Promise.all([
      sql`SELECT COUNT(*)::int AS n, MAX((SELECT sr.receipt_date FROM sales_receipts sr WHERE sr.id = srl.receipt_id))::text AS last
          FROM sales_receipt_lines srl WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n, MAX((SELECT b.bill_date FROM bills b WHERE b.id = bl.bill_id))::text AS last
          FROM bill_lines bl WHERE item_id = ${id}`,
      sql`SELECT COUNT(*)::int AS n, MAX(count_date)::text AS last FROM stock_counts WHERE item_id = ${id}`,
    ])

    // Look for an active item with the same or very similar name
    const candidates = await sql`
      SELECT id, canonical_name, cf_group, status FROM items
      WHERE id != ${id} AND LOWER(status) = 'active'
        AND SIMILARITY(LOWER(canonical_name), LOWER(${item.canonical_name})) > 0.5
      ORDER BY SIMILARITY(LOWER(canonical_name), LOWER(${item.canonical_name})) DESC
      LIMIT 5
    `.catch(() => [])

    const mergeHistory = await sql`
      SELECT id, staff_name, action, details, created_at FROM activity_logs
      WHERE action = 'merged items' AND details ILIKE ${'%' + item.canonical_name + '%'}
      ORDER BY created_at
    `

    out[id] = {
      item, sales: sales, bills: bills, counts: counts,
      similarActiveCandidates: candidates, mergeHistory,
    }
  }

  return NextResponse.json(out)
}
