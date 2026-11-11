import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// GET ?tapId=ID -- what a sale already in the Sales Log holds, to make a pending job from it (paid in full, so nothing is owed): the customer and the receipt's items.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const tapId = Number(req.nextUrl.searchParams.get('tapId'))
    const [tap] = await sql`SELECT id, receipt_id, customer_id_code FROM live_sale_taps WHERE id = ${tapId}`
    if (!tap) return badRequest('That sale was not found.')
    const taps = await sql`SELECT id, item_id, item_name, price::float8 AS price, quantity FROM live_sale_taps WHERE NOT undone AND (id = ${tapId} OR (${tap.receipt_id}::int IS NOT NULL AND receipt_id = ${tap.receipt_id}))`
    const [buyer] = await sql`SELECT customer_id_code, customer_name, customer_phone FROM sale_buyers WHERE tap_id = ${tapId} OR receipt_id = ${tap.receipt_id} ORDER BY id LIMIT 1`.catch(() => [])
    const lines = taps.map(t => ({ item_id: t.item_id, name: t.item_name, qty: Number(t.quantity), price: Number(t.price) }))
    return success({ receipt_id: tap.receipt_id, customer_id: buyer?.customer_id_code ?? tap.customer_id_code ?? null, customer: buyer?.customer_name ?? '', phone: buyer?.customer_phone ?? '', lines })
  } catch (e) { return handleError('pending-jobs from-sale', e) }
}
