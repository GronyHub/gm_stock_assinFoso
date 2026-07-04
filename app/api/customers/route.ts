import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const customers = await sql`
    SELECT
      c.id, c.display_name, c.company_name, c.first_name, c.last_name,
      c.email, c.phone, c.status, c.payment_terms_label,
      c.opening_balance, c.credit_limit, c.notes, c.is_internal,
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
