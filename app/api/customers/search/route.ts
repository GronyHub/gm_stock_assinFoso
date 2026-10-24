import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureCustomerPhones } from '@/lib/customerPhones'
import { NextRequest } from 'next/server'

// Light type-ahead for the GM box: customers whose name, company, ID or phone matches.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 40)
  const phone = (req.nextUrl.searchParams.get('phone') ?? '').replace(/\D/g, '')
  const num = (req.nextUrl.searchParams.get('num') ?? '').replace(/\D/g, '').slice(0, 10)
  try {
    // Digits typed so far: a customer ID starting with them (e.g. 12 -> GM12, GM120), or,
    // if they start with 0, a saved phone number starting with them.
    if (num) {
      const rows = num.startsWith('0')
        ? await sql`SELECT id, customer_id_code, display_name, company_name, phone FROM customers
            WHERE customer_id_code IS NOT NULL AND (regexp_replace(COALESCE(phone, ''), '\D', '', 'g') LIKE ${num + '%'}
              OR EXISTS (SELECT 1 FROM customer_phones p WHERE p.customer_id = customers.id AND p.phone LIKE ${num + '%'}))
            ORDER BY display_name LIMIT 8`
        : await sql`SELECT id, customer_id_code, display_name, company_name, phone FROM customers
            WHERE customer_id_code LIKE ${'GM' + num + '%'}
            ORDER BY (customer_id_code = ${'GM' + num}) DESC, length(customer_id_code), id LIMIT 8`
      return success(rows)
    }
    // Exact phone check (last 9 digits), used to tell a saved number from a new one.
    if (phone.length >= 9) {
      const rows = await sql`
        SELECT id, customer_id_code, display_name, company_name, phone FROM customers
        WHERE customer_id_code IS NOT NULL AND (RIGHT(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 9) = ${phone.slice(-9)}
          OR EXISTS (SELECT 1 FROM customer_phones p WHERE p.customer_id = customers.id AND RIGHT(regexp_replace(p.phone, '\D', '', 'g'), 9) = ${phone.slice(-9)})) LIMIT 3`
      return success(rows)
    }
    if (q.length < 2) return success([])
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
