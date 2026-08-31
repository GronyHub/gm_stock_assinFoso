import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { syncVcpForItems } from '@/lib/vcpSync'
import { NextRequest } from 'next/server'

type ReceiveLine = { poLineId: number; qty: number; price: number }

// Receiving items against a PO creates a real Bill for exactly what arrived
// in this batch (so it shows up in Bills/CAB/P&L like any other purchase),
// links it back to the PO via purchase_order_receipts, and tops up each
// line's qty_received. Called once per delivery -- a partially-delivered
// order is simply received more than once, each time with only the lines
// (and quantities) that actually showed up.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params
    const poId = Number(id)

    const { date, lines } = await req.json() as { date?: string; lines?: ReceiveLine[] }
    if (!date || !lines?.length) return badRequest('Missing fields')

    const received = lines.filter(l => Number(l.qty) > 0)
    if (received.length === 0) return badRequest('Enter a quantity for at least one item.')

    // A PO's vendor is recorded either way -- picked from the dropdown
    // (vendor_id only, purchase_orders.vendor_name stays NULL) or typed as
    // free text (vendor_name only, vendor_id NULL). GET /api/purchase-orders
    // already resolves the display name the same way for POTab's own list;
    // reading the raw column here without it meant a bill created from a
    // dropdown-picked vendor got vendor_name = NULL, so it showed up in
    // Bills as "No vendor" even though the PO clearly had one.
    const [po] = await sql`
      SELECT po.id, po.po_number, po.vendor_id, COALESCE(v.display_name, po.vendor_name) AS vendor_name, po.status
      FROM purchase_orders po
      LEFT JOIN vendors v ON v.id = po.vendor_id
      WHERE po.id = ${poId}
    `
    if (!po) return badRequest('Not found')
    if (po.status !== 'sent') {
      return badRequest('Only a sent purchase order can receive items -- send it first.')
    }

    const poLines = await sql`SELECT id, item_id, item_name, qty_ordered, qty_received FROM purchase_order_lines WHERE po_id = ${poId}` as
      { id: number; item_id: number | null; item_name: string; qty_ordered: number; qty_received: number }[]
    const poLineById = new Map(poLines.map(l => [l.id, l]))

    for (const l of received) {
      const line = poLineById.get(l.poLineId)
      if (!line) return badRequest('One of these lines no longer exists on this order.')
      const remaining = Number(line.qty_ordered) - Number(line.qty_received)
      if (Number(l.qty) > remaining + 0.001) {
        return badRequest(`"${line.item_name}" only has ${remaining} left to receive.`)
      }
    }

    const total = received.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0)
    const billNumber = `PO-BILL-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

    let bill
    try {
      [bill] = await sql`
        INSERT INTO bills (bill_number, bill_date, vendor_id, vendor_name, total, subtotal, status, source, entered_by, zoho_bill_id)
        VALUES (${billNumber}, ${date}, ${po.vendor_id ?? null}, ${po.vendor_name ?? null}, ${total}, ${total}, 'paid', 'po', ${actor}, ${billNumber})
        RETURNING id
      `
    } catch (e) {
      console.error('bills insert with entered_by failed, retrying without it:', e)
      ;[bill] = await sql`
        INSERT INTO bills (bill_number, bill_date, vendor_id, vendor_name, total, subtotal, status, source, zoho_bill_id)
        VALUES (${billNumber}, ${date}, ${po.vendor_id ?? null}, ${po.vendor_name ?? null}, ${total}, ${total}, 'paid', 'po', ${billNumber})
        RETURNING id
      `
    }

    for (const l of received) {
      const line = poLineById.get(l.poLineId)!
      const lineTotal = Number(l.qty) * Number(l.price)
      await sql`
        INSERT INTO bill_lines (bill_id, item_id, raw_item_name, resolved_name, quantity, unit_price, item_total, unresolved, source)
        VALUES (${bill.id}, ${line.item_id}, ${line.item_name}, ${line.item_name}, ${l.qty}, ${l.price}, ${lineTotal}, false, 'po')
      `
      await sql`
        UPDATE purchase_order_lines SET qty_received = qty_received + ${l.qty} WHERE id = ${l.poLineId}
      `
    }

    await sql`
      INSERT INTO purchase_order_receipts (po_id, bill_id, received_date, received_by)
      VALUES (${poId}, ${bill.id}, ${date}, ${actor})
    `

    try {
      const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${date}`
      if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date})`
    } catch (e) {
      console.error('cash_at_bank ensure-row error (non-fatal):', e)
    }

    await logActivity(actor, 'received purchase order items', `${po.po_number} · ₵${total.toFixed(2)} → ${billNumber}`)
    await syncVcpForItems(received.map(l => poLineById.get(l.poLineId)!.item_id))
    return success({ ok: true, billId: bill.id, billNumber })
  } catch (e) {
    return handleError('purchase-orders/[id]/receive', e)
  }
}
