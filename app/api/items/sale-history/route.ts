import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

// Per-item first/last sale date and average monthly quantity, off the full
// sales_receipt_lines history (every WIC/GMC sale ever recorded), not just
// Live Sale's own taps -- an item can have years of sales predating Live
// Sale's own tap log, and "1st recorded sale" means the real first one.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const rows = await sql`
      SELECT
        srl.item_id,
        MIN(sr.receipt_date)::date::text AS first_sale_date,
        MAX(sr.receipt_date)::date::text AS last_sale_date,
        SUM(srl.quantity)::numeric AS total_qty
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id IS NOT NULL
      GROUP BY srl.item_id
    ` as unknown as { item_id: number; first_sale_date: string; last_sale_date: string; total_qty: string }[]

    const result = rows.map(r => {
      const first = new Date(r.first_sale_date + 'T00:00:00Z')
      const last = new Date(r.last_sale_date + 'T00:00:00Z')
      // Inclusive month span between first and last sale -- same calendar
      // month counts as 1, not 0, so an item only ever sold on one day
      // doesn't divide its total by zero.
      const monthsSpan = Math.max(1,
        (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + (last.getUTCMonth() - first.getUTCMonth()) + 1)
      const totalQty = parseFloat(r.total_qty) || 0
      return {
        item_id: r.item_id,
        first_sale_date: r.first_sale_date,
        last_sale_date: r.last_sale_date,
        avg_monthly_qty: Math.round((totalQty / monthsSpan) * 10) / 10,
      }
    })
    return success(result)
  } catch (e) {
    return handleError('items/sale-history GET', e)
  }
}
