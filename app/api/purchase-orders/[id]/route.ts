import { requireAuth, badRequest, notFound, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await ensurePurchaseOrderTables()
    const [[po], lines, receipts] = await Promise.all([
      sql`
        SELECT po.id, po.po_number, po.vendor_id,
          COALESCE(v.display_name, po.vendor_name) AS vendor_name,
          po.order_date::date AS order_date,
          po.expected_date::date AS expected_date, po.status, po.notes, po.created_by, po.created_at::text
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        WHERE po.id = ${Number(id)}
      `,
      sql`
        SELECT id, item_id, item_name, qty_ordered, qty_received, unit_price
        FROM purchase_order_lines WHERE po_id = ${Number(id)} ORDER BY sort_order
      `,
      sql`
        SELECT r.id, r.received_date::date AS received_date, r.received_by, r.bill_id,
          b.bill_number
        FROM purchase_order_receipts r
        LEFT JOIN bills b ON b.id = r.bill_id
        WHERE r.po_id = ${Number(id)}
        ORDER BY r.received_date DESC, r.id DESC
      `,
    ])
    if (!po) return notFound()

    const billIds = (receipts as any[]).map(r => r.bill_id).filter(Boolean)
    const receiptLines = billIds.length > 0
      ? await sql`
          SELECT bill_id, item_id, COALESCE(resolved_name, raw_item_name) AS item_name, quantity, unit_price, item_total
          FROM bill_lines WHERE bill_id = ANY(${billIds})
        `
      : []
    const linesByBill = new Map<number, typeof receiptLines>()
    for (const l of receiptLines as any[]) {
      if (!linesByBill.has(l.bill_id)) linesByBill.set(l.bill_id, [])
      linesByBill.get(l.bill_id)!.push(l)
    }
    const receiptsWithLines = (receipts as any[]).map(r => ({ ...r, lines: linesByBill.get(r.bill_id) ?? [] }))

    return success({ ...po, lines, receipts: receiptsWithLines })
  } catch (e) {
    return handleError('purchase-order GET', e)
  }
}

type LineInput = { itemId: number | null; itemName: string; qty: number; price: number }

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  const { id } = await params
  const poId = Number(id)
  const { status, notes, expectedDate, orderDate, vendorId, vendorName, lines } = await req.json() as {
    status?: string; notes?: string | null; expectedDate?: string | null
    orderDate?: string; vendorId?: number | null; vendorName?: string | null
    lines?: LineInput[]
  }

  if (status && !['draft', 'sent', 'cancelled'].includes(status)) {
    return badRequest('Invalid status')
  }

  try {
    // Full line replacement -- only while still a draft, same rule as
    // Delete: nothing's been sent to the vendor or received against it yet,
    // so swapping the whole item list out is safe.
    if (lines) {
      const [po] = await sql`SELECT status FROM purchase_orders WHERE id = ${poId}`
      if (!po) return notFound()
      if (po.status !== 'draft') {
        return badRequest('Only a draft purchase order can have its items changed -- cancel it and start a new one instead.')
      }
      if (!lines.length) return badRequest('A purchase order needs at least one item.')
      for (const l of lines) {
        const qty = Number(l.qty)
        if (!Number.isFinite(qty) || qty <= 0) {
          return badRequest(`"${l.itemName || 'a line'}" needs a valid quantity greater than 0.`)
        }
      }
      await sql`DELETE FROM purchase_order_lines WHERE po_id = ${poId}`
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i]
        await sql`
          INSERT INTO purchase_order_lines (po_id, item_id, item_name, qty_ordered, unit_price, sort_order)
          VALUES (${poId}, ${l.itemId ?? null}, ${l.itemName}, ${l.qty}, ${l.price}, ${i})
        `
      }
    }

    const [row] = await sql`
      UPDATE purchase_orders
      SET
        status = COALESCE(${status ?? null}, status),
        notes = CASE WHEN ${notes !== undefined} THEN ${notes ?? null} ELSE notes END,
        expected_date = CASE WHEN ${expectedDate !== undefined} THEN ${expectedDate ?? null} ELSE expected_date END,
        order_date = COALESCE(${orderDate ?? null}, order_date),
        vendor_id = CASE WHEN ${vendorId !== undefined} THEN ${vendorId ?? null} ELSE vendor_id END,
        vendor_name = CASE WHEN ${vendorName !== undefined} THEN ${vendorName ?? null} ELSE vendor_name END
      WHERE id = ${poId}
      RETURNING id, po_number, status, vendor_name
    `
    if (!row) return notFound()

    const actor = getActorName(session)
    if (status) await logActivity(actor, 'updated purchase order', `${row.po_number} → ${status}`)
    else if (lines) await logActivity(actor, 'edited purchase order', row.po_number)
    return success(row)
  } catch (e) {
    return handleError('purchase-order PATCH', e)
  }
}

// Only a still-empty draft (nothing received against any line) can be
// deleted -- once something's been sent or received, cancel it instead so
// the record (and any Bills already created from it) stays intact.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error
  const { id } = await params

  try {
    const [po] = await sql`SELECT status FROM purchase_orders WHERE id = ${Number(id)}`
    if (!po) return notFound()
    if (po.status !== 'draft') {
      return badRequest('Only a draft purchase order can be deleted -- cancel it instead.')
    }
    const [{ received }] = await sql`
      SELECT COALESCE(SUM(qty_received), 0) AS received FROM purchase_order_lines WHERE po_id = ${Number(id)}
    `
    if (Number(received) > 0) {
      return badRequest('This purchase order already has items received -- cancel it instead.')
    }
    await sql`DELETE FROM purchase_orders WHERE id = ${Number(id)}`
    return success({ ok: true })
  } catch (e) {
    return handleError('purchase-order DELETE', e)
  }
}
