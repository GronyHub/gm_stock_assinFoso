import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'

// customers predates a location field -- ADD COLUMN IF NOT EXISTS is cheap
// once it's there, so just ensure it on every request rather than a
// separate migration step (same approach as invoices' customer_* columns).
// created_at is retrofitted too -- existing rows all get the same "now"
// timestamp the moment this runs, not their real signup date, so the
// "new customers this week" flag will read artificially high for the first
// week after this ships and settle down after that.
async function ensureColumns() {
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_group_added BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_visited DATE`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS service_goods TEXT`.catch(() => {})
  await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()`.catch(() => {})
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  await initializeDatabase()
  await ensureColumns()
  const customers = await sql`
    SELECT
      c.id, c.display_name, c.company_name, c.first_name, c.last_name,
      c.email, c.phone, c.location, c.status, c.payment_terms_label,
      c.opening_balance, c.credit_limit, c.notes, c.is_internal,
      c.whatsapp_group_added, c.last_visited::text AS last_visited, c.service_goods,
      c.created_at::text AS created_at,
      COUNT(DISTINCT sr.id)::int              AS receipt_count,
      COALESCE(SUM(sr.total), 0)::numeric     AS receipt_total,
      COALESCE(SUM(sr.balance), 0)::numeric   AS receipt_balance,
      COUNT(DISTINCT inv.id)::int             AS invoice_count,
      COALESCE(SUM(inv.total), 0)::numeric    AS invoice_total,
      COALESCE(SUM(inv.balance), 0)::numeric  AS invoice_outstanding
    FROM customers c
    LEFT JOIN sales_receipts sr ON sr.customer_id = c.id
    LEFT JOIN invoices inv       ON inv.customer_id = c.id
    GROUP BY c.id
    ORDER BY receipt_total DESC
  `
  return NextResponse.json(customers)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    display_name, company_name, first_name, last_name,
    email, phone, location, payment_terms_label, opening_balance, credit_limit, notes,
    whatsapp_group_added, last_visited, service_goods,
  } = await req.json()

  if (!display_name || !String(display_name).trim()) {
    return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
  }

  const enteredBy = session.user?.name || (session.user as any)?.username || null

  try {
    await initializeDatabase()
  await ensureColumns()
    const [customer] = await sql`
      INSERT INTO customers
        (display_name, company_name, first_name, last_name, email, phone, location,
         status, payment_terms_label, opening_balance, credit_limit, notes, is_internal,
         whatsapp_group_added, last_visited, service_goods)
      VALUES
        (${String(display_name).trim()}, ${company_name || null}, ${first_name || null}, ${last_name || null},
         ${email || null}, ${phone || null}, ${location || null},
         'Active', ${payment_terms_label || null}, ${opening_balance || 0}, ${credit_limit || null}, ${notes || null}, false,
         ${whatsapp_group_added ?? false}, ${last_visited || null}, ${service_goods || null})
      RETURNING
        id, display_name, company_name, first_name, last_name, email, phone, location,
        status, payment_terms_label, opening_balance, credit_limit, notes, is_internal,
        whatsapp_group_added, last_visited::text AS last_visited, service_goods, created_at::text AS created_at
    `

    await logActivity(enteredBy ?? 'Unknown', 'added customer', customer.display_name)
    return NextResponse.json({
      ...customer,
      receipt_count: 0, receipt_total: '0', receipt_balance: '0',
      invoice_count: 0, invoice_total: '0', invoice_outstanding: '0',
    })
  } catch (e) {
    console.error('customer insert error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save customer: ${detail}` }, { status: 500 })
  }
}
