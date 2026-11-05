import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { ensureSaleBuyers } from '@/lib/saleBuyers'
import { NextRequest } from 'next/server'

// POST { buyerIds?: number[], invoiceId?: number } -- staff pressed Send on the WhatsApp message / receipt for these
// sales. Recorded so the Sales Log can show which sales have had their message sent.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureSaleBuyers()
    const b = await req.json().catch(() => ({}))
    const buyerIds = (Array.isArray(b.buyerIds) ? b.buyerIds : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 60)
    const invoiceId = Number(b.invoiceId)
    if (!buyerIds.length && !(invoiceId > 0)) return badRequest('Nothing to mark.')
    const who = getActorName(session)
    if (buyerIds.length) await sql`UPDATE sale_buyers SET wa_sent_at = now(), wa_sent_by = ${who} WHERE id = ANY(${buyerIds})`
    if (invoiceId > 0) await sql`UPDATE invoices SET wa_sent_at = now(), wa_sent_by = ${who} WHERE id = ${invoiceId}`
    return success({ ok: true })
  } catch (e) { return handleError('sales/wa-sent', e) }
}
