import { requireAuth, badRequest, notFound, getActorName, success, handleError } from '@/lib/api'
import { getIdParam } from '@/lib/api/params'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { syncVcpForItems } from '@/lib/vcpSync'
import { NextRequest } from 'next/server'

// Bills previously had no way to correct a line after saving -- only the
// bill's own date/vendor/attachments (see /api/bills/[id]). Needed so a
// mistyped unit price (the usual cause of a VCP JUMP flag) can actually be
// fixed, instead of deleting and re-entering the whole bill.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const lineId = await getIdParam(params)
  const { quantity, unit_price } = await req.json() as { quantity?: number; unit_price?: number }
  if (quantity === undefined && unit_price === undefined) {
    return badRequest('Nothing to update.')
  }

  const [line] = await sql`SELECT id, bill_id, item_id, quantity, unit_price FROM bill_lines WHERE id = ${lineId}`
  if (!line) return notFound()

  const qty = quantity !== undefined ? Number(quantity) : Number(line.quantity)
  const price = unit_price !== undefined ? Number(unit_price) : Number(line.unit_price)
  if (!Number.isFinite(qty) || qty <= 0) return badRequest('Quantity must be greater than 0.')
  if (!Number.isFinite(price) || price < 0) return badRequest('Unit price must be 0 or more.')

  try {
    const total = qty * price
    const [updated] = await sql`
      UPDATE bill_lines SET quantity = ${qty}, unit_price = ${price}, item_total = ${total}
      WHERE id = ${lineId}
      RETURNING id, bill_id, item_id, quantity, unit_price, item_total
    `
    // Keep the parent bill's own total/subtotal in sync with the sum of its
    // lines -- most app-created bills have exactly one line, but historical/
    // imported bills can have several, so this re-sums rather than assuming.
    await sql`
      UPDATE bills SET
        total = (SELECT COALESCE(SUM(item_total), 0) FROM bill_lines WHERE bill_id = ${line.bill_id}),
        subtotal = (SELECT COALESCE(SUM(item_total), 0) FROM bill_lines WHERE bill_id = ${line.bill_id})
      WHERE id = ${line.bill_id}
    `

    const actor = getActorName(session)
    await logActivity(actor, 'edited bill line', `Line #${lineId} on bill #${line.bill_id} -- qty ${qty} @ ₵${price.toFixed(2)}`)
    await syncVcpForItems([line.item_id])

    return success(updated)
  } catch (e) {
    return handleError('bill-lines/[id] PUT', e)
  }
}
