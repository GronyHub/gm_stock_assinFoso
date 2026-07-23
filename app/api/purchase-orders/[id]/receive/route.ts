import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

type ReceiveLine = { poLineId: number; qty: number; price: number }

// Receiving items against a PO creates a real Bill for exactly what arrived
// in this batch (so it shows up in Gd In/CAB/P&L like any other purchase),
// links it back to the PO via purchase_order_receipts, and tops up each
// line's qty_received. Called once per delivery -- a partially-delivered
// order is simply received more than once, each time with only the lines
// (and quantities) that actually showed up.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const poId = Number(id)

  const { date, lines } = await req.json() as { date?: string; lines?: ReceiveLine[] }
  if (!date || !lines?.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const received = lines.filter(l => Number(l.qty) > 0)
  if (received.length === 0) return NextResponse.json({ error: 'Enter a quantity for at least one item.' }, { status: 400 })

  try {
    const [po] = await sql`SELECT id, po_number, vendor_id, vendor_name, status FROM purchase_orders WHERE id = ${poId}`
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (po.status !== 'sent') {
      return NextResponse.json({ error: 'Only a sent purchase order can receive items -- send it first.' }, { status: 400 })
    }

    const poLines = await sql`SELECT id, item_id, item_name, qty_ordered, qty_received FROM purchase_order_lines WHERE po_id = ${poId}` as
      { id: number; item_id: number | null; item_name: string; qty_ordered: number; qty_received: number }[]
    const poLineById = new Map(poLines.map(l => [l.id, l]))

    for (const l of received) {
      const line = poLineById.get(l.poLineId)
      if (!line) return NextResponse.json({ error: 'One of these lines no longer exists on this order.' }, { status: 400 })
      const remaining = Number(line.qty_ordered) - Number(line.qty_received)
      if (Number(l.qty) > remaining + 0.001) {
        return NextResponse.json({ error: `"${line.item_name}" only has ${remaining} left to receive.` }, { status: 400 })
      }
    }

    const total = received.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0)
    const billNumber = `PO-BILL-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

    const [bill] = await sql`
      INSERT INTO bills (bill_number, bill_date, vendor_id, vendor_name, total, subtotal, status, source, entered_by)
      VALUES (${billNumber}, ${date}, ${po.vendor_id ?? null}, ${po.vendor_name ?? null}, ${total}, ${total}, 'paid', 'po', ${actor})
      RETURNING id
    `

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
    return NextResponse.json({ ok: true, billId: bill.id, billNumber })
  } catch (e) {
    console.error('purchase-order receive error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not receive items: ${detail}` }, { status: 500 })
  }
}
