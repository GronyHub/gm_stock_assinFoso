import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSaleBuyers, createCustomerFromPhone } from '@/lib/saleBuyers'
import { normalizeGhPhone } from '@/lib/customerProfile'
import { NextRequest } from 'next/server'

// POST { name, phone? } -- attach a buyer to a customer from the Sales Log. If the phone belongs
// to a saved customer that customer is used; otherwise a new customer is created from name + phone.
// Every buyer row for the same phone / customer on that receipt is updated together.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureSaleBuyers()
    const id = Number((await params).id)
    const b = await req.json().catch(() => ({}))
    const [row] = await sql`SELECT id, receipt_id, customer_phone FROM sale_buyers WHERE id = ${id}`
    if (!row) return badRequest('Unknown record.')
    const phone = normalizeGhPhone(b.phone ?? row.customer_phone)
    const name = String(b.name ?? '').trim()
    if (!phone) return badRequest('Enter the customer\'s phone number (10 digits starting with 0).')
    let [known] = await sql`SELECT customer_id_code, display_name FROM customers WHERE customer_id_code IS NOT NULL AND RIGHT(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 9) = ${phone.slice(-9)} LIMIT 1`
    if (!known) {
      if (!name) return badRequest('Type the customer\'s name to save them as a new customer.')
      const created = await createCustomerFromPhone(name, phone, getActorName(session))
      if (!created) return badRequest('Could not create the customer.')
      known = { customer_id_code: created.code, display_name: name }
    }
    await sql`UPDATE sale_buyers SET customer_phone = ${phone}, customer_id_code = ${known.customer_id_code}, customer_name = ${known.display_name}
      WHERE receipt_id = ${row.receipt_id} AND (id = ${id} OR (customer_phone = ${phone}) OR customer_id_code = ${known.customer_id_code})`
    return success({ ok: true, customer_id_code: known.customer_id_code, customer_name: known.display_name, phone })
  } catch (e) { return handleError('sales/buyers POST', e) }
}
