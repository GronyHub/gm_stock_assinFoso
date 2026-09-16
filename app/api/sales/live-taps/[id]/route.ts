import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable, reverseTapReceiptEffect } from '@/lib/liveSales'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth()
  if (error) return error

  const { id: idStr } = await params
  const action = req.nextUrl.searchParams.get('action') || 'undo'
  const id = parseInt(idStr)

  if (!id) return badRequest('Invalid tap ID')

  try {
    await ensureLiveSaleTapsTable()

    if (action === 'undo') {
      const [tap] = await sql`
        SELECT item_id, quantity, price, receipt_id, receipt_line_id, undone, receipt_reversed
        FROM live_sale_taps WHERE id = ${id}
      `
      if (!tap) return badRequest('Tap not found')
      // Already undone AND already reversed -- nothing left to do, and
      // re-running the reversal would double-subtract from the receipt
      // line. (undone without receipt_reversed means an older bug marked
      // it undone without ever reversing it -- see /reconcile for that.)
      if (tap.undone && tap.receipt_reversed) return success({ success: true })

      await reverseTapReceiptEffect(tap as any)
      await sql`UPDATE live_sale_taps SET undone = true, receipt_reversed = true WHERE id = ${id}`
      return success({ success: true })
    }

    if (action === 'update-time') {
      const body = await req.json()
      const { tappedAt } = body
      if (!tappedAt) return badRequest('Missing tappedAt')

      await sql`UPDATE live_sale_taps SET tapped_at = ${tappedAt} WHERE id = ${id}`
      const [tap] = await sql`SELECT tapped_at FROM live_sale_taps WHERE id = ${id}`
      return success({ tapped_at: tap?.tapped_at })
    }

    if (action === 'update-full') {
      const body = await req.json()
      const { quantity, customPrice, tappedAt } = body

      const newQty = quantity != null ? Number(quantity) : null
      const newPrice = customPrice != null ? Number(customPrice) : null
      const newTappedAt = tappedAt || null

      if (newQty != null && newQty < 1) return badRequest('Quantity must be 1 or more')
      if (newPrice != null && newPrice <= 0) return badRequest('Price must be greater than 0')

      // Fetch current tap details
      const [currentTap] = await sql`
        SELECT id, quantity, price, receipt_line_id, receipt_id, item_name, staff_name
        FROM live_sale_taps WHERE id = ${id}
      `
      if (!currentTap) return badRequest('Tap not found')

      const oldQty = Number(currentTap.quantity) || 1
      const oldPrice = Number(currentTap.price) || 0
      const actualNewQty = newQty ?? oldQty
      const actualNewPrice = newPrice ?? oldPrice
      const oldTotal = oldQty * oldPrice
      const newTotal = actualNewQty * actualNewPrice

      // Update the tap
      await sql`
        UPDATE live_sale_taps
        SET quantity = ${actualNewQty}, price = ${actualNewPrice}, tapped_at = ${newTappedAt}
        WHERE id = ${id}
      `

      // Update receipt line if it exists
      if (currentTap.receipt_line_id) {
        const [line] = await sql`
          UPDATE sales_receipt_lines
          SET quantity = ${actualNewQty}, item_total = ${newTotal}
          WHERE id = ${currentTap.receipt_line_id}
          RETURNING id
        `

        // Update receipt total
        if (line && currentTap.receipt_id) {
          await sql`
            UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${currentTap.receipt_id})
            WHERE id = ${currentTap.receipt_id}
          `
        }
      }

      const [updatedTap] = await sql`
        SELECT id, quantity, price, tapped_at FROM live_sale_taps WHERE id = ${id}
      `

      return success({
        tap: updatedTap,
        message: `Updated ${currentTap.item_name}: ${actualNewQty} × ₵${actualNewPrice.toFixed(2)}`
      })
    }

    return badRequest('Unknown action')
  } catch (e) {
    return handleError('sales/live-taps/[id]', e)
  }
}
