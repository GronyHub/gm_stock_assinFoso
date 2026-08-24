import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { initializeDatabase } from '@/lib/dbInitialize'
import { once } from '@/lib/once'

// vendors predates a location field -- ADD COLUMN IF NOT EXISTS is cheap
// once it's there, so just ensure it on every request (same approach as
// customers' location column).
const ensureColumns = once(async () => {
  await sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
})

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  await initializeDatabase()
  await ensureColumns()
  const vendors = await sql`
    SELECT
      v.id, v.display_name, v.company_name, v.email, v.phone, v.location,
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
  return success(vendors)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { display_name, company_name, email, phone, location, notes } = await req.json()

  if (!display_name || !String(display_name).trim()) {
    return badRequest('Vendor name is required')
  }

  const enteredBy = getActorName(session)

  try {
    await initializeDatabase()
    await ensureColumns()
    const [vendor] = await sql`
      INSERT INTO vendors
        (display_name, company_name, email, phone, location, status, is_internal, notes)
      VALUES
        (${String(display_name).trim()}, ${company_name || null}, ${email || null}, ${phone || null}, ${location || null}, 'Active', false, ${notes || null})
      RETURNING
        id, display_name, company_name, email, phone, location, status, payment_terms_label, is_internal, notes
    `

    await logActivity(enteredBy, 'added vendor', vendor.display_name)
    return success({
      ...vendor,
      bill_count: 0, bill_total: '0', outstanding: '0', payment_count: 0, amount_paid: '0',
    })
  } catch (e) {
    return handleError('vendor insert', e)
  }
}
