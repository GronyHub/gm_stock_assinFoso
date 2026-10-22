import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSaleBuyers } from '@/lib/saleBuyers'
import { purchaseWhatsAppUrl, normalizeGhPhone, customerLifetimeTotal } from '@/lib/customerProfile'
import { NextRequest } from 'next/server'

// GET ?ids=1,2,3 -> one WhatsApp link with all those purchases in a single message
// (a customer buying several items gets one message, not one per item).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    await ensureSaleBuyers()
    const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 40)
    if (!ids.length) return badRequest('No purchases chosen.')
    const rows = await sql`
      SELECT b.item_name, b.qty, b.price, b.customer_id_code, b.customer_name, b.customer_phone,
             c.phone AS saved_phone, c.first_name, c.display_name
      FROM sale_buyers b LEFT JOIN customers c ON c.customer_id_code = b.customer_id_code
      WHERE b.id = ANY(${ids}) ORDER BY b.id`
    if (!rows.length) return badRequest('Purchases not found.')
    const phone = rows.map(r => normalizeGhPhone(r.customer_phone) ?? normalizeGhPhone(r.saved_phone)).find(Boolean)
    if (!phone) return badRequest('No phone number for this customer yet. Add it first.')
    const first = rows[0]
    const name = (first.first_name || first.display_name || first.customer_name) as string | null
    const url = purchaseWhatsAppUrl(phone, rows.map(r => ({ name: r.item_name as string, qty: Number(r.qty), price: Number(r.price) })), (first.customer_id_code as string | null), name, await customerLifetimeTotal(first.customer_id_code as string | null))
    return success({ url })
  } catch (e) { return handleError('sales/buyers/whatsapp', e) }
}
