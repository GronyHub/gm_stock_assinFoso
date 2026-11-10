import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'

// The top strip shows the LIVE Customer service laws (code and title), so Company Laws is the one place the rules are written.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const rows = await sql`SELECT code, title FROM page_laws WHERE category = 'Customer service' AND status = 'live' AND audience = 'staff' AND code IS NOT NULL AND title IS NOT NULL AND title <> '' ORDER BY id`
    return success({ laws: rows.map(r => ({ code: String(r.code), text: String(r.title) })) })
  } catch (e) { return handleError('customer-service strip', e) }
}
