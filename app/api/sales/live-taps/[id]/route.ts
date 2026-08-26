import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
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
        SELECT item_id, quantity, price, receipt_id, receipt_line_id, undone
        FROM live_sale_taps WHERE id = ${id}
      `
      if (!tap) return badRequest('Tap not found')
      // Already undone -- nothing left to reverse, and re-running the
      // decrement below would double-subtract from the receipt line.
      if (tap.undone) return success({ success: true })

      // Reverse this tap's own contribution to the receipt line it fed
      // into (see live_sale_taps' own schema comment: receipt_line_id
      // exists exactly so undo can find it). Several taps of the same
      // item on the same receipt share one line, so this only backs out
      // what this tap itself added, not the whole line.
      if (tap.receipt_line_id) {
        const lineAmount = Number(tap.price) * Number(tap.quantity)
        const [updatedLine] = await sql`
          UPDATE sales_receipt_lines
          SET quantity = quantity::numeric - ${tap.quantity}, item_total = item_total::numeric - ${lineAmount}
          WHERE id = ${tap.receipt_line_id}
          RETURNING quantity
        `
        if (updatedLine && Number(updatedLine.quantity) <= 0) {
          await sql`DELETE FROM sales_receipt_lines WHERE id = ${tap.receipt_line_id}`
        }
      }
      if (tap.receipt_id) {
        await sql`
          UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id})
          WHERE id = ${tap.receipt_id}
        `
      }

      // Best-effort reversal of the GMC "material consumption" bill line a
      // service-using-GMC tap creates (see /api/sales/live-tap) -- there's
      // no stored link back to the exact bill_lines row it made, so this
      // matches the most recent same-day, same-item, same-quantity negative
      // line as a reasonable stand-in. Never blocks the undo itself.
      try {
        const [item] = await sql`
          SELECT product_type, gmc_type, converts_to_item_id FROM items WHERE id = ${tap.item_id}
        `
        if (item?.product_type === 'service' && item.gmc_type === 'service_using_gmc' && item.converts_to_item_id) {
          await sql`
            DELETE FROM bill_lines WHERE id = (
              SELECT bl.id FROM bill_lines bl
              JOIN bills b ON b.id = bl.bill_id
              WHERE b.vendor_name = 'Internal Consumption'
                AND bl.item_id = ${item.converts_to_item_id}
                AND bl.quantity = ${-tap.quantity}
              ORDER BY bl.id DESC LIMIT 1
            )
          `
        }
      } catch (e) {
        console.error('[live-taps undo] Failed to reverse GMC consumption line:', e)
      }

      await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${id}`
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

    return badRequest('Unknown action')
  } catch (e) {
    return handleError('sales/live-taps/[id]', e)
  }
}
