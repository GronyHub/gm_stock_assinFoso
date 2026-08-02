import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Same fields New Customer can set, now editable after the fact --
// COALESCE against the existing value so a field left out of the request
// (rather than explicitly cleared to "") is untouched, not wiped.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const {
    company_name, first_name, last_name, email, phone, location, notes,
    payment_terms_label, credit_limit,
    whatsapp_group_added, last_visited, service_goods,
  } = await req.json()

  try {
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_group_added BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visited DATE`.catch(() => {})
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS service_goods TEXT`.catch(() => {})
    await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.catch(() => {})

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
    if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
    await logActivity(actor, 'edited customer', customer.display_name)
    return NextResponse.json(customer)
  } catch (e) {
    console.error('customer PATCH error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save customer: ${detail}` }, { status: 500 })
  }
}
