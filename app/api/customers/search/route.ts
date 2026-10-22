import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// Light type-ahead for the GM box: customers whose name, company, ID or phone matches.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  if (q.length < 2) return success([])
  try {
    const like = `%${q}%`
    const rows = await sql`
      SELECT id, customer_id_code, display_name, company_name, phone
      FROM customers
      WHERE customer_id_code IS NOT NULL AND (is_internal IS NOT TRUE)
        AND (display_name ILIKE ${like} OR COALESCE(company_name, '') ILIKE ${like}
             OR COALESCE(first_name, '') ILIKE ${like} OR COALESCE(last_name, '') ILIKE ${like})
      ORDER BY (display_name ILIKE ${q + '%'}) DESC, display_name
      LIMIT 8`
    return success(rows)
  } catch (e) {
    console.error('customers search:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}
