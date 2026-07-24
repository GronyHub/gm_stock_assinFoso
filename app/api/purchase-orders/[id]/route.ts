import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    await ensurePurchaseOrderTables()
    const [[po], lines, receipts] = await Promise.all([
      sql`
        SELECT id, po_number, vendor_id, vendor_name, order_date::date AS order_date,
          expected_date::date AS expected_date, status, notes, created_by, created_at::text
        FROM purchase_orders WHERE id = ${Number(id)}
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
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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

    return NextResponse.json({ ...po, lines, receipts: receiptsWithLines })
  } catch (e) {
    console.error('purchase-order GET error:', e)
    return NextResponse.json({ error: 'Failed to load purchase order' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { status, notes, expectedDate } = await req.json() as { status?: string; notes?: string | null; expectedDate?: string | null }

  if (status && !['draft', 'sent', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  try {
    const [row] = await sql`
      UPDATE purchase_orders
      SET
        status = COALESCE(${status ?? null}, status),
        notes = CASE WHEN ${notes !== undefined} THEN ${notes ?? null} ELSE notes END,
        expected_date = CASE WHEN ${expectedDate !== undefined} THEN ${expectedDate ?? null} ELSE expected_date END
      WHERE id = ${Number(id)}
      RETURNING id, po_number, status, vendor_name
    `
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    if (status) await logActivity(actor, 'updated purchase order', `${row.po_number} → ${status}`)
    return NextResponse.json(row)
  } catch (e) {
    console.error('purchase-order PATCH error:', e)
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}

// Only a still-empty draft (nothing received against any line) can be
// deleted -- once something's been sent or received, cancel it instead so
// the record (and any Bills already created from it) stays intact.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  try {
    const [po] = await sql`SELECT status FROM purchase_orders WHERE id = ${Number(id)}`
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (po.status !== 'draft') {
      return NextResponse.json({ error: 'Only a draft purchase order can be deleted -- cancel it instead.' }, { status: 400 })
    }
    const [{ received }] = await sql`
      SELECT COALESCE(SUM(qty_received), 0) AS received FROM purchase_order_lines WHERE po_id = ${Number(id)}
    `
    if (Number(received) > 0) {
      return NextResponse.json({ error: 'This purchase order already has items received -- cancel it instead.' }, { status: 400 })
    }
    await sql`DELETE FROM purchase_orders WHERE id = ${Number(id)}`
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('purchase-order DELETE error:', e)
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
  }
}
