import { requireAuth, badRequest, notFound, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest } from 'next/server'

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

// PATCH { status: 'same' | 'different' | null, qty? } -- tick a line while the delivery is being counted.
// 'same' = what is still due arrived in full; 'different' = qty is what really arrived (can be 0 or more
// than ordered). null un-ticks it. Nothing is received or billed until the receipt is confirmed.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; lineId: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePurchaseOrderTables()
    const { id, lineId } = await params
    const b = await req.json().catch(() => ({}))
    const [line] = await sql`SELECT id, qty_ordered, qty_received FROM purchase_order_lines WHERE id = ${Number(lineId)} AND po_id = ${Number(id)}`
    if (!line) return notFound()
    const remaining = Math.max(0, Number(line.qty_ordered) - Number(line.qty_received))
    const actor = getActorName(session)
    if (b.status === 'same') {
      await sql`UPDATE purchase_order_lines SET check_status = 'same', check_qty = ${remaining}, checked_by = ${actor}, checked_at = now() WHERE id = ${line.id}`
    } else if (b.status === 'different') {
      const q = Number(b.qty)
      if (!Number.isFinite(q) || q < 0 || q > 1000000) return badRequest('Enter the number that really arrived (0 or more).')
      await sql`UPDATE purchase_order_lines SET check_status = 'different', check_qty = ${q}, checked_by = ${actor}, checked_at = now() WHERE id = ${line.id}`
    } else {
      await sql`UPDATE purchase_order_lines SET check_status = NULL, check_qty = NULL, checked_by = NULL, checked_at = NULL WHERE id = ${line.id}`
    }
    return success({ ok: true })
  } catch (e) { return handleError('purchase-orders line PATCH', e) }
}
