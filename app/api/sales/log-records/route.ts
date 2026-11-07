import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { NextRequest } from 'next/server'

// The Sales Log's record side, for one date range: the day receipts (walk-in and GMC, with cash counted, photos
// and who entered them) and the receipt lines that no Live Sale tap stands behind -- the history imported from
// Zoho / Bizims back to 2023 and lines typed in by hand. Tapped sales come from /api/sales/live-taps, so a line a
// tap made isn't sent twice. Read-only: this replaced the editable Sales Rec / Summary screen.
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
const GMC = 'Grony Multimedia as Customer'
const isDay = (s: string | null) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)

export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  const from = req.nextUrl.searchParams.get('from'), to = req.nextUrl.searchParams.get('to')
  if (!isDay(from) || !isDay(to)) return badRequest('from and to dates are needed (YYYY-MM-DD).')
  try {
    const receipts = await sql`
      SELECT id, receipt_number, receipt_date::date::text AS day, customer_name, (customer_name = ${GMC}) AS is_gmc,
             total, cash_counted, entered_by, COALESCE(attachments, '[]'::jsonb) AS attachments
      FROM sales_receipts
      WHERE receipt_date::date BETWEEN ${from}::date AND ${to}::date
      ORDER BY receipt_date DESC, id`
    const lines = await sql`
      SELECT l.id, l.receipt_id, r.receipt_date::date::text AS day, (r.customer_name = ${GMC}) AS is_gmc,
             l.item_id, COALESCE(l.resolved_name, l.raw_item_name, '?') AS item_name,
             l.quantity, l.item_price, l.item_total, l.source
      FROM sales_receipt_lines l
      JOIN sales_receipts r ON r.id = l.receipt_id
      WHERE r.receipt_date::date BETWEEN ${from}::date AND ${to}::date
        AND NOT EXISTS (SELECT 1 FROM live_sale_taps t WHERE t.receipt_line_id = l.id)
      ORDER BY r.receipt_date DESC, l.id`
    return success({ receipts, lines })
  } catch (e) {
    return handleError('sales/log-records', e)
  }
}
