import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureLiveSaleTapsTable, reverseTapReceiptEffect } from '@/lib/liveSales'

// One-off fix for taps undone before the undo handler actually reversed
// their receipt line (see reverseTapReceiptEffect/receipt_reversed in
// lib/liveSales.ts) -- those taps are marked undone but their quantity is
// still sitting in sales_receipt_lines, so the Sales tab and stock totals
// still count them as sold. Safe to run more than once: it only ever
// touches rows where undone = true AND receipt_reversed = false, and marks
// each one reversed as it goes, so a second run finds nothing left to do.
export async function POST() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Only Grony or Joe can run this')

  try {
    await ensureLiveSaleTapsTable()

    const stale = await sql`
      SELECT id, item_id, item_name, quantity, price, receipt_id, receipt_line_id
      FROM live_sale_taps
      WHERE undone = true AND receipt_reversed = false
    `

    if (stale.length === 0) {
      return success({ success: true, reconciled: 0, message: 'Nothing to fix -- every undone tap is already reversed.' })
    }

    for (const tap of stale) {
      await reverseTapReceiptEffect(tap as any)
      await sql`UPDATE live_sale_taps SET receipt_reversed = true WHERE id = ${tap.id}`
    }

    return success({
      success: true,
      reconciled: stale.length,
      taps: stale.map(t => ({ id: t.id, item_name: t.item_name, quantity: t.quantity })),
      message: `Reversed ${stale.length} previously-undone tap${stale.length !== 1 ? 's' : ''} that were never backed out of the receipt totals.`,
    })
  } catch (e) {
    return handleError('sales/live-taps/reconcile POST', e)
  }
}
