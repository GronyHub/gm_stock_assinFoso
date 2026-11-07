import { clearItemsCache } from '@/lib/itemsCache'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable, reverseTapReceiptEffect, refileTapOnReceipts } from '@/lib/liveSales'
import { NextRequest } from 'next/server'

// Keeps a customer receipt in step when one of its sales is undone: that line is removed and the
// total recalculated; a receipt with no lines left is deleted.
async function syncReceiptAfterTapChange(invoiceId: number, tapId: number) {
  await sql`DELETE FROM invoice_lines WHERE tap_id = ${tapId}`
  const [left] = await sql`SELECT COUNT(*)::int AS n FROM invoice_lines WHERE invoice_id = ${invoiceId}`
  if (!left.n) { await sql`DELETE FROM invoices WHERE id = ${invoiceId}`; return }
  await sql`UPDATE invoices SET total = (SELECT COALESCE(SUM(item_total), 0) FROM invoice_lines WHERE invoice_id = ${invoiceId}),
    subtotal = (SELECT COALESCE(SUM(item_total), 0) FROM invoice_lines WHERE invoice_id = ${invoiceId}) WHERE id = ${invoiceId}`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  clearItemsCache()
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
        SELECT item_id, quantity, price, receipt_id, receipt_line_id, undone, receipt_reversed, invoice_id
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
      // Sold through MI: take this item off the customer's receipt too (the receipt goes if it was the last item).
      if (tap.invoice_id) await syncReceiptAfterTapChange(Number(tap.invoice_id), id)
      return success({ success: true })
    }

    if (action === 'update-time') {
      const body = await req.json()
      const { tappedAt } = body
      if (!tappedAt) return badRequest('Missing tappedAt')

      const [before] = await sql`
        SELECT id, item_id, item_name, quantity, price, receipt_id, receipt_line_id, undone, staff_name,
               tapped_at::date::text AS old_day
        FROM live_sale_taps WHERE id = ${id}`
      await sql`UPDATE live_sale_taps SET tapped_at = ${tappedAt} WHERE id = ${id}`
      const [tap] = await sql`SELECT tapped_at, tapped_at::date::text AS new_day FROM live_sale_taps WHERE id = ${id}`
      // Moved to another day: move it onto that day's receipt too (an undone sale is already off the receipts).
      if (before && !before.undone && tap && tap.new_day !== before.old_day) {
        const q = Number(before.quantity) || 1, p = Number(before.price) || 0
        await refileTapOnReceipts(
          { id: Number(before.id), item_id: Number(before.item_id), item_name: String(before.item_name), receipt_id: before.receipt_id, receipt_line_id: before.receipt_line_id },
          { qty: q, price: p }, { qty: q, price: p, tappedAt: tap.tapped_at }, before.staff_name)
      }
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
        SELECT id, item_id, quantity, price, receipt_line_id, receipt_id, item_name, staff_name, undone, tapped_at
        FROM live_sale_taps WHERE id = ${id}
      `
      if (!currentTap) return badRequest('Tap not found')

      const oldQty = Number(currentTap.quantity) || 1
      const oldPrice = Number(currentTap.price) || 0
      const actualNewQty = newQty ?? oldQty
      const actualNewPrice = newPrice ?? oldPrice
      const newTotal = actualNewQty * actualNewPrice

      // Update the tap
      await sql`
        UPDATE live_sale_taps
        SET quantity = ${actualNewQty}, price = ${actualNewPrice}, tapped_at = COALESCE(${newTappedAt}, tapped_at)
        WHERE id = ${id}
      `

      // Day receipts: this sale's own share of its item line changes (not the whole line, which also holds the
      // day's other sales of the item), and it moves to another day's receipt if its date changed. An undone
      // sale is already off the receipts.
      if (!currentTap.undone && currentTap.receipt_id) {
        await refileTapOnReceipts(
          { id: Number(currentTap.id), item_id: Number(currentTap.item_id), item_name: String(currentTap.item_name), receipt_id: currentTap.receipt_id, receipt_line_id: currentTap.receipt_line_id },
          { qty: oldQty, price: oldPrice }, { qty: actualNewQty, price: actualNewPrice, tappedAt: newTappedAt ?? currentTap.tapped_at }, currentTap.staff_name)
      }

      const [updatedTap] = await sql`
        SELECT id, quantity, price, tapped_at, invoice_id FROM live_sale_taps WHERE id = ${id}
      `
      if (updatedTap?.invoice_id) {
        await sql`UPDATE invoice_lines SET quantity = ${actualNewQty}, item_price = ${actualNewPrice}, item_total = ${newTotal} WHERE tap_id = ${id}`
        await sql`UPDATE invoices SET total = (SELECT COALESCE(SUM(item_total), 0) FROM invoice_lines WHERE invoice_id = ${updatedTap.invoice_id}),
          subtotal = (SELECT COALESCE(SUM(item_total), 0) FROM invoice_lines WHERE invoice_id = ${updatedTap.invoice_id}) WHERE id = ${updatedTap.invoice_id}`
      }

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
