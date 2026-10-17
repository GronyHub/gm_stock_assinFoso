import { requireAuth, badRequest, notFound, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'

// Remove one line that has not been received at all (e.g. the vendor could not
// supply it). Lines with anything received stay, since a bill already counts them.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const { id, lineId } = await params
    const poId = Number(id), lId = Number(lineId)
    const [po] = await sql`SELECT po_number, status FROM purchase_orders WHERE id = ${poId}`
    if (!po) return notFound()
    if (po.status === 'cancelled') return badRequest('A cancelled purchase order cannot be changed.')
    const lines = await sql`SELECT id, item_name, qty_received FROM purchase_order_lines WHERE po_id = ${poId}` as { id: number; item_name: string; qty_received: number }[]
    const line = lines.find(l => l.id === lId)
    if (!line) return notFound()
    if (Number(line.qty_received) > 0.001) return badRequest('This line has already been (partly) received, so it cannot be deleted.')
    if (lines.length === 1) return badRequest('This is the only line. Cancel the purchase order instead.')
    await sql`DELETE FROM purchase_order_lines WHERE id = ${lId} AND po_id = ${poId}`
    await logActivity(getActorName(session), 'deleted purchase order line', `${po.po_number} · ${line.item_name}`)
    return success({ ok: true })
  } catch (e) { return handleError('purchase-orders line DELETE', e) }
}
