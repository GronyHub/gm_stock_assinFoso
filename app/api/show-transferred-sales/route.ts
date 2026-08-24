import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const [ppService] = await sql`
      SELECT id, canonical_name, converts_to_item_id
      FROM items
      WHERE canonical_name = 'Passport Picture'
        AND gmc_type = 'service_using_gmc'
    `

    if (!ppService) {
      return badRequest('Passport Picture service not found')
    }

    const [targetItem] = await sql`
      SELECT id, canonical_name FROM items WHERE id = ${ppService.converts_to_item_id}
    `

    if (!targetItem) {
      return badRequest('Target item not found')
    }

    const sales = await sql`
      SELECT
        srl.id,
        srl.receipt_id,
        srl.item_id,
        srl.resolved_name,
        srl.qty,
        srl.unit_price,
        srl.line_total,
        srl.created_at,
        sr.receipt_date,
        sr.customer_name,
        sr.notes
      FROM sales_receipt_lines srl
      JOIN sales_receipts sr ON srl.receipt_id = sr.id
      WHERE srl.item_id = ${targetItem.id}
      ORDER BY sr.receipt_date DESC
      LIMIT 50
    `

    return success({
      transferred_from: ppService.canonical_name,
      transferred_to: targetItem.canonical_name,
      total_sales_lines: sales.length,
      sales: sales.map(s => ({
        id: s.id,
        receipt_id: s.receipt_id,
        date: s.receipt_date,
        customer: s.customer_name,
        qty: s.qty,
        unit_price: s.unit_price,
        line_total: s.line_total,
        notes: s.notes,
      })),
    })
  } catch (e) {
    return handleError('show-transferred-sales', e)
  }
}
