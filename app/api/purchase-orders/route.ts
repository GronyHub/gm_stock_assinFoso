import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensurePurchaseOrderTables } from '@/lib/purchaseOrders'
import { NextRequest } from 'next/server'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'

export async function GET() {
  try {
    await ensureDbInitialized()
    await ensurePurchaseOrderTables()
    const [pos, lines] = await Promise.all([
      sql`
        SELECT po.id, po.po_number, po.vendor_id,
          COALESCE(v.display_name, po.vendor_name) AS vendor_name,
          po.order_date::date AS order_date,
          po.expected_date::date AS expected_date, po.status, po.notes, po.created_by, po.created_at::text
        FROM purchase_orders po
        LEFT JOIN vendors v ON v.id = po.vendor_id
        ORDER BY po.created_at DESC
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
    return success(result)
  } catch (e) {
    console.error('purchase-orders GET error:', e)
    return success([])
  }
}

type LineInput = { itemId: number | null; itemName: string; qty: number; price: number }

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { orderDate, expectedDate, vendorId, vendorName, notes, lines } = await req.json() as {
    orderDate?: string; expectedDate?: string | null; vendorId?: number | null; vendorName?: string | null
    notes?: string | null; lines?: LineInput[]
  }
  if (!orderDate || !lines?.length) return badRequest('Missing fields')

  for (const l of lines) {
    const qty = Number(l.qty)
    if (!Number.isFinite(qty) || qty <= 0) {
      return badRequest(`"${l.itemName || 'a line'}" needs a valid quantity greater than 0.`)
    }
  }

  const createdBy = (session!.user as any)?.username || session!.user?.name || 'Unknown'
  const poNumber = `PO-${orderDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`

  try {
    await ensureDbInitialized()
    await ensurePurchaseOrderTables()
    const [po] = await sql`
      INSERT INTO purchase_orders (po_number, vendor_id, vendor_name, order_date, expected_date, status, notes, created_by)
      VALUES (${poNumber}, ${vendorId ?? null}, ${vendorName ?? null}, ${orderDate}, ${expectedDate ?? null}, 'draft', ${notes ?? null}, ${createdBy})
      RETURNING id
    `

    // Batch insert all PO lines in parallel
    await Promise.all(
      lines.map((l, i) =>
        sql`
          INSERT INTO purchase_order_lines (po_id, item_id, item_name, qty_ordered, unit_price, sort_order)
          VALUES (${po.id}, ${l.itemId ?? null}, ${l.itemName}, ${l.qty}, ${l.price}, ${i})
        `
      )
    )
    await logActivity(createdBy, 'created purchase order', `${poNumber}${vendorName ? ` from ${vendorName}` : ''}`)
    return success({ ok: true, id: po.id, poNumber })
  } catch (e) {
    return handleError('purchase-orders POST', e)
  }
}
