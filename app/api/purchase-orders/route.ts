import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    await ensurePurchaseOrderTables()
    const [pos, lines] = await Promise.all([
      sql`
        SELECT id, po_number, vendor_id, vendor_name, order_date::date AS order_date,
          expected_date::date AS expected_date, status, notes, created_by, created_at::text
        FROM purchase_orders
        ORDER BY created_at DESC
      `,
      sql`
        SELECT po_id, item_id, item_name, qty_ordered, qty_received, unit_price
        FROM purchase_order_lines
        ORDER BY po_id, sort_order
      `,
    ])
    const linesByPo = new Map<number, typeof lines>()
    for (const l of lines as any[]) {
      if (!linesByPo.has(l.po_id)) linesByPo.set(l.po_id, [])
      linesByPo.get(l.po_id)!.push(l)
    }
    const result = (pos as any[]).map(po => ({ ...po, lines: linesByPo.get(po.id) ?? [] }))
    return NextResponse.json(result)
  } catch (e) {
    console.error('purchase-orders GET error:', e)
    return NextResponse.json([])
  }
}

type LineInput = { itemId: number | null; itemName: string; qty: number; price: number }

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orderDate, expectedDate, vendorId, vendorName, notes, lines } = await req.json() as {
    orderDate?: string; expectedDate?: string | null; vendorId?: number | null; vendorName?: string | null
    notes?: string | null; lines?: LineInput[]
  }
  if (!orderDate || !lines?.length) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  for (const l of lines) {
    const qty = Number(l.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return NextResponse.json({ error: `"${l.itemName || 'a line'}" needs a valid quantity greater than 0.` }, { status: 400 })
    }
  }

  const createdBy = (session.user as any)?.username || session.user?.name || 'Unknown'
  const poNumber = `PO-${orderDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`

  try {
    await ensurePurchaseOrderTables()
    const [po] = await sql`
      INSERT INTO purchase_orders (po_number, vendor_id, vendor_name, order_date, expected_date, status, notes, created_by)
      VALUES (${poNumber}, ${vendorId ?? null}, ${vendorName ?? null}, ${orderDate}, ${expectedDate ?? null}, 'draft', ${notes ?? null}, ${createdBy})
      RETURNING id
    `
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      await sql`
        INSERT INTO purchase_order_lines (po_id, item_id, item_name, qty_ordered, unit_price, sort_order)
        VALUES (${po.id}, ${l.itemId ?? null}, ${l.itemName}, ${l.qty}, ${l.price}, ${i})
      `
    }
    await logActivity(createdBy, 'created purchase order', `${poNumber}${vendorName ? ` from ${vendorName}` : ''}`)
    return NextResponse.json({ ok: true, id: po.id, poNumber })
  } catch (e) {
    console.error('purchase-orders POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save purchase order: ${detail}` }, { status: 500 })
  }
}
