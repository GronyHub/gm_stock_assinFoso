import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_group_added BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visited DATE`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS service_goods TEXT`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.catch(() => {})
})


async function checkCustomerRelations(customerId: number) {
  try {
    const receipts = await sql`SELECT COUNT(*)::int as count FROM sales_receipts WHERE customer_id = ${customerId}`
    const invoices = await sql`SELECT COUNT(*)::int as count FROM invoices WHERE customer_id = ${customerId}`.catch(() => [{ count: 0 }])

    const totalCount = (receipts[0]?.count || 0) + (invoices[0]?.count || 0)
    return totalCount
  } catch (e) {
    return -1
  }
}

// Same fields New Customer can set, now editable after the fact --
// COALESCE against the existing value so a field left out of the request
// (rather than explicitly cleared to "") is untouched, not wiped.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const {
    company_name, first_name, last_name, email, phone, location, notes,
    payment_terms_label, credit_limit,
    whatsapp_group_added, last_visited, service_goods,
  } = await req.json()

  try {
    await ensureSchema()

    const [customer] = await sql`
      UPDATE customers SET
        company_name         = CASE WHEN ${company_name !== undefined} THEN ${company_name || null} ELSE company_name END,
        first_name            = CASE WHEN ${first_name !== undefined} THEN ${first_name || null} ELSE first_name END,
        last_name             = CASE WHEN ${last_name !== undefined} THEN ${last_name || null} ELSE last_name END,
        email                 = CASE WHEN ${email !== undefined} THEN ${email || null} ELSE email END,
        phone                 = CASE WHEN ${phone !== undefined} THEN ${phone || null} ELSE phone END,
        location              = CASE WHEN ${location !== undefined} THEN ${location || null} ELSE location END,
        notes                 = CASE WHEN ${notes !== undefined} THEN ${notes || null} ELSE notes END,
        payment_terms_label   = CASE WHEN ${payment_terms_label !== undefined} THEN ${payment_terms_label || null} ELSE payment_terms_label END,
        credit_limit          = CASE WHEN ${credit_limit !== undefined} THEN ${credit_limit || null} ELSE credit_limit END,
        whatsapp_group_added  = CASE WHEN ${whatsapp_group_added !== undefined} THEN ${whatsapp_group_added ?? false} ELSE whatsapp_group_added END,
        last_visited          = CASE WHEN ${last_visited !== undefined} THEN ${last_visited || null} ELSE last_visited END,
        service_goods         = CASE WHEN ${service_goods !== undefined} THEN ${service_goods || null} ELSE service_goods END
      WHERE id = ${Number(id)}
      RETURNING id, display_name, company_name, first_name, last_name, email, phone, location,
        status, payment_terms_label, opening_balance, credit_limit, notes, is_internal,
        whatsapp_group_added, last_visited::text AS last_visited, service_goods, created_at::text AS created_at
    `
    if (!customer) return notFound()

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    // 10 minutes flat, same "typing" convention as 'added customer'.
    await logActivity(actor, 'edited customer', customer.display_name, 600)
    return success(customer)
  } catch (e) {
    return handleError('customer PATCH', e)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const customerId = Number(id)

  try {
    // Check if customer has any related records
    const relatedCount = await checkCustomerRelations(customerId)

    if (relatedCount > 0) {
      return badRequest(`Cannot delete customer: has ${relatedCount} related transaction(s) (sales/invoices). Delete related records first or mark as inactive.`)
    }

    // Get customer name before deletion for logging
    const [customer] = await sql`SELECT display_name FROM customers WHERE id = ${customerId}`
    if (!customer) {
      return notFound()
    }

    // Delete the customer
    await sql`DELETE FROM customers WHERE id = ${customerId}`

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    await logActivity(actor, 'deleted customer', customer.display_name)

    return success({ success: true, message: `Customer '${customer.display_name}' deleted` })
  } catch (e) {
    return handleError('customer DELETE', e)
  }
}
