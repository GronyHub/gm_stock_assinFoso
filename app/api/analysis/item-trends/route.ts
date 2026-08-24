import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT
        i.id, i.canonical_name,
        SUM(CASE WHEN sr.receipt_date >= CURRENT_DATE - INTERVAL '30 days' THEN srl.quantity ELSE 0 END)::numeric AS qty_30d,
        SUM(CASE WHEN sr.receipt_date >= CURRENT_DATE - INTERVAL '90 days' THEN srl.quantity ELSE 0 END)::numeric AS qty_90d,
        SUM(srl.quantity)::numeric AS qty_all,
        COUNT(DISTINCT srl.receipt_id) FILTER (WHERE sr.receipt_date >= CURRENT_DATE - INTERVAL '30 days') AS receipts_30d
      FROM items i
      LEFT JOIN sales_receipt_lines srl ON srl.item_id = i.id
      LEFT JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
      GROUP BY i.id, i.canonical_name
      ORDER BY qty_30d DESC NULLS LAST
    `
    return success(rows)
  } catch (e) {
    return handleError('analysis/item-trends', e)
  }
}
