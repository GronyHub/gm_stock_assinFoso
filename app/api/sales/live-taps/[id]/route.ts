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

    return badRequest('Unknown action')
  } catch (e) {
    return handleError('sales/live-taps/[id]', e)
  }
}
