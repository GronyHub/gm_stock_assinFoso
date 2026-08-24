import { requireAuth, getActorName, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params

  try {
    const [tap] = await sql`SELECT * FROM live_sale_taps WHERE id = ${Number(id)}`
    if (!tap) return notFound()
    if (tap.undone) return success({ ok: true, alreadyUndone: true })

    await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${tap.id}`

    const qty = Number(tap.quantity) || 1
    const lineAmount = Number(tap.price) * qty

    if (tap.receipt_line_id) {
      const [line] = await sql`
        UPDATE sales_receipt_lines
        SET quantity = quantity::numeric - ${qty}, item_total = item_total::numeric - ${lineAmount}
        WHERE id = ${tap.receipt_line_id}
        RETURNING id, quantity
      `
      if (line && Number(line.quantity) <= 0) {
        await sql`DELETE FROM sales_receipt_lines WHERE id = ${line.id}`
      }
      if (tap.receipt_id) {
        await sql`
          UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id})
          WHERE id = ${tap.receipt_id}
        `
      }
    }

    const actor = getActorName(session)
    await logActivity(actor, 'undid live sale tap', `${tap.item_name} × ${qty} · ₵${lineAmount.toFixed(2)} (tapped by ${tap.staff_name})`)

    return success({ ok: true })
  } catch (e) {
    return handleError('sales/live-tap/[id]', e)
  }
}
