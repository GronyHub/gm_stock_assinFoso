import { requireAuth, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
})


// Same fields New Vendor can set, now editable after the fact -- CASE WHEN
// so a field left out of the request (rather than explicitly cleared to
// "") is untouched, not wiped (same pattern as customers' PATCH route).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const { company_name, email, phone, location, notes, payment_terms_label } = await req.json()

  try {
    await ensureSchema()

    const [vendor] = await sql`
      UPDATE vendors SET
        company_name        = CASE WHEN ${company_name !== undefined} THEN ${company_name || null} ELSE company_name END,
        email                = CASE WHEN ${email !== undefined} THEN ${email || null} ELSE email END,
        phone                = CASE WHEN ${phone !== undefined} THEN ${phone || null} ELSE phone END,
        location             = CASE WHEN ${location !== undefined} THEN ${location || null} ELSE location END,
        notes                = CASE WHEN ${notes !== undefined} THEN ${notes || null} ELSE notes END,
        payment_terms_label  = CASE WHEN ${payment_terms_label !== undefined} THEN ${payment_terms_label || null} ELSE payment_terms_label END
      WHERE id = ${Number(id)}
      RETURNING id, display_name, company_name, email, phone, location, status, payment_terms_label, is_internal, notes
    `
    if (!vendor) return notFound()

    const actor = (session.user as { username?: string })?.username || session.user?.name || 'Unknown'
    // 10 minutes flat, same "typing" convention as 'added vendor'.
    await logActivity(actor, 'edited vendor', vendor.display_name, 600)
    return success(vendor)
  } catch (e) {
    return handleError('vendor PATCH', e)
  }
}
