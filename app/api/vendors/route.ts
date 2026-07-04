import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const vendors = await sql`
    SELECT
      v.id, v.display_name, v.company_name, v.email, v.phone,
      v.status, v.payment_terms_label, v.is_internal, v.notes,
      COUNT(DISTINCT b.id)::int             AS bill_count,
      COALESCE(SUM(b.total), 0)::numeric    AS bill_total,
      COALESCE(SUM(b.balance), 0)::numeric  AS outstanding,
      COUNT(DISTINCT vp.id)::int            AS payment_count,
      COALESCE(SUM(vp.amount), 0)::numeric  AS amount_paid
    FROM vendors v
    LEFT JOIN bills b            ON b.vendor_id = v.id
    LEFT JOIN vendor_payments vp ON vp.vendor_id = v.id
    GROUP BY v.id
    ORDER BY bill_total DESC
  `
  return NextResponse.json(vendors)
}
