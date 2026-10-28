import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSaleBuyers } from '@/lib/saleBuyers'
import { NextRequest } from 'next/server'

// GET ?q=asco -> descriptions recently used to name who did a piece of work ("Asco teacher",
// "Girl in yellow shirt"): sales recorded with a name but no customer and no phone number.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureSaleBuyers()
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 60)
    const rows = await sql`
      SELECT customer_name AS label, MAX(created_at) AS last_used
      FROM sale_buyers
      WHERE customer_id_code IS NULL AND customer_phone IS NULL AND customer_name IS NOT NULL
        AND created_at > now() - interval '90 days'
        AND (${q} = '' OR customer_name ILIKE ${'%' + q + '%'})
      GROUP BY customer_name ORDER BY last_used DESC LIMIT 6`
    return success(rows.map(r => r.label as string))
  } catch (e) { return handleError('sales/labels', e) }
}
