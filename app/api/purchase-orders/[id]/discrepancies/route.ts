import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest } from 'next/server'

// POST { reported: boolean, ids?: number[] } -- mark differences as reported (or not) to the supplier.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensurePurchaseOrderTables()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const ids = Array.isArray(b.ids) ? b.ids.map(Number).filter(Number.isInteger) : null
    if (ids && !ids.length) return badRequest('Nothing chosen.')
    if (ids) await sql`UPDATE purchase_order_discrepancies SET reported = ${!!b.reported} WHERE po_id = ${id} AND id = ANY(${ids})`
    else await sql`UPDATE purchase_order_discrepancies SET reported = ${!!b.reported} WHERE po_id = ${id}`
    return success({ ok: true })
  } catch (e) { return handleError('purchase-orders discrepancies', e) }
}
