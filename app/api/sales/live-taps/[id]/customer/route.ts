import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { ensureSaleBuyers, recordBuyer, createCustomerFromPhone } from '@/lib/saleBuyers'
import { normalizeGhPhone } from '@/lib/customerProfile'
import { findCustomerByPhone } from '@/lib/customerPhones'
import { NextRequest } from 'next/server'

// POST { code?: 'GM12', phone?: '0244…', name?: string }
// From the Sales Log: attach a customer to a sale that was recorded without one (or look the
// buyer up again for WhatsApp). A saved customer is found by their GM ID or phone; a new phone number
// with a name is saved as a new customer. Returns buyerId for the WhatsApp message.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureLiveSaleTapsTable(); await ensureSaleBuyers()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const [tap] = await sql`SELECT id, item_id, item_name, price, quantity, receipt_id, customer_id_code, staff_name FROM live_sale_taps WHERE id = ${id}`
    if (!tap) return badRequest('Sale not found.')

    const phone = normalizeGhPhone(b.phone)
    let code: string | null = typeof b.code === 'string' && /^GM\d+$/i.test(b.code) ? b.code.toUpperCase() : (tap.customer_id_code as string | null)
    type Cust = { customer_id_code: string; display_name: string; phone: string | null }
    let cust: Cust | undefined
    if (code) { const rows = await sql`SELECT customer_id_code, display_name, phone FROM customers WHERE customer_id_code = ${code}`; cust = rows[0] as Cust | undefined }
    if (!cust && phone) cust = (await findCustomerByPhone(phone)) ?? undefined
    if (!cust) {
      const name = String(b.name ?? '').trim()
      if (!phone) return badRequest('Enter the customer\'s phone number (10 digits starting with 0) or their GM ID.')
      if (!name) return badRequest('This number is not a saved customer. Type their name to save them.')
      const created = await createCustomerFromPhone(name, phone, getActorName(session), 'sales_log')
      if (!created) return badRequest('Could not create the customer.')
      cust = { customer_id_code: created.code, display_name: name, phone }
    }
    code = cust.customer_id_code
    await sql`UPDATE live_sale_taps SET customer_id_code = ${code} WHERE id = ${id}`
    const [existing] = await sql`SELECT id FROM sale_buyers WHERE tap_id = ${id} LIMIT 1`
    let buyerId = existing?.id as number | null
    const buyerPhone = normalizeGhPhone(cust.phone) ?? phone
    if (buyerId) {
      await sql`UPDATE sale_buyers SET customer_id_code = ${code}, customer_name = ${cust.display_name}, customer_phone = ${buyerPhone} WHERE id = ${buyerId}`
    } else {
      buyerId = await recordBuyer({ receiptId: tap.receipt_id as number | null, tapId: id, itemId: tap.item_id as number, itemName: tap.item_name as string,
        qty: Number(tap.quantity), price: Number(tap.price), customerIdCode: code, customerName: cust.display_name, customerPhone: buyerPhone, source: 'live_sale', createdBy: getActorName(session) })
    }
    return success({ buyerId, customer_id_code: code, customer_name: cust.display_name, phone: buyerPhone })
  } catch (e) { return handleError('sales/live-taps customer', e) }
}
