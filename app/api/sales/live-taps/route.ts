import { requireAuth, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest } from 'next/server'

// All taps from all days (not cleared), undone ones included (shown struck-through client
// side rather than hidden) -- this is the raw decomposition of all taps by date
// so staff can refer back to previous days' sales
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const days = req.nextUrl.searchParams.get('days') || '90'

  await ensureLiveSaleTapsTable()
  const daysInt = parseInt(days)
  // soh is a per-tap snapshot recorded at insert time (see /api/sales/
  // live-tap's POST), not a live join -- it needs to read as "what the
  // stock was right after this tap", not today's current stock, or every
  // past tap of the same item would show the same (wrong) number.
  //
  // is_gmc isn't its own column on this table -- live-tap's POST never
  // stored the WIC/GMC toggle it was recorded under, only which receipt it
  // fed into. That receipt's own customer_name already says which it was
  // ('Grony Multimedia as Customer' for GMC, NULL for WIC -- see
  // /api/sales/live-tap), so a join derives it for every tap, past or
  // future, with no backfill needed.
  const rows = await sql`
    SELECT t.id, t.item_id, t.item_name, t.price, t.staff_name, t.tapped_at, t.undone, t.receipt_id, t.quantity, t.soh,
           (r.customer_name = 'Grony Multimedia as Customer') AS is_gmc
    FROM live_sale_taps t
    LEFT JOIN sales_receipts r ON r.id = t.receipt_id
    WHERE t.tapped_at >= CURRENT_TIMESTAMP - MAKE_INTERVAL(days => ${daysInt})
    ORDER BY t.tapped_at DESC
  `
  return success(rows)
}
