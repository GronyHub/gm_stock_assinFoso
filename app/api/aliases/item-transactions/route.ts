import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// Backs the Alias Wide Table's row drill-down: given an item (including a
// 'Pending Review' stub created from an unidentified legacy name), return
// enough to tell what it actually is -- its own record plus every real
// sale/bill line ever posted against it, oldest first.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const itemIdParam = req.nextUrl.searchParams.get('itemId')
  const itemId = itemIdParam ? Number(itemIdParam) : NaN
  if (!Number.isFinite(itemId)) return badRequest('itemId required')

  try {
    const [item] = await sql`
      SELECT id, canonical_name, status, cf_group, description
      FROM items WHERE id = ${itemId}
    ` as { id: number; canonical_name: string; status: string | null; cf_group: string | null; description: string | null }[]
    if (!item) return notFound()

    const sales = await sql`
      SELECT sr.receipt_date::date::text AS date, srl.quantity, srl.item_price, srl.item_total, srl.source
      FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ${itemId}
      ORDER BY sr.receipt_date ASC
    `

    const bills = await sql`
      SELECT b.bill_date::date::text AS date, bl.quantity, bl.unit_price, bl.item_total, bl.source
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id = ${itemId}
      ORDER BY b.bill_date ASC
    `

    return success({ item, sales, bills })
  } catch (e) {
    return handleError('aliases/item-transactions', e)
  }
}
