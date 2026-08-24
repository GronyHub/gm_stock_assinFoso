import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { itemsDueForCount, countGuardResponseBody } from '@/lib/countGuard'
import { NextRequest } from 'next/server'

// Ghana is UTC+0 year-round, so an ISO UTC date slice is already the
// correct local calendar date -- same convention the rest of Sales uses.
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Live Sale is Walk-In only (see AGENTS.md-adjacent decision: GMC keeps
// using the regular New Sale form) -- every tap folds into the single
// shared WIC receipt for today, same "one receipt per day" rule the
// regular New Sale flow enforces, just built up incrementally instead of
// created once with a full cart.
//
// Known tradeoff: the find-or-create-receipt and update-or-insert-line
// steps below are each two round trips (check, then act), not a single
// atomic statement. Two staff tapping the exact same brand-new item (or
// both being the very first tap of a new day) within the same instant
// could each end up creating their own row instead of one merged one.
// The totals stay correct either way -- it just means an occasional extra
// line/receipt to merge by hand, exactly like the existing dup_receipt
// flag already catches for manually-entered receipts.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const { itemId, quantity, customPrice, isGMC } = await req.json()
    if (!itemId) return badRequest('Missing itemId')
    const qty = Math.max(1, Math.floor(Number(quantity) || 1))

    const staffName = session.user?.name || (session.user as { username?: string })?.username || 'Unknown'
    const date = todayStr()
    console.log('[live-tap] Starting tap:', { itemId, qty, staffName, date })

    await ensureLiveSaleTapsTable()
    console.log('[live-tap] Table ensured')

    const [item] = await sql`SELECT id, canonical_name, selling_rate, product_type FROM items WHERE id = ${Number(itemId)}`
    console.log('[live-tap] Item fetched:', item?.canonical_name)
    if (!item) return badRequest('Item not found')

    const due = await itemsDueForCount([item.id])
    if (due.size > 0 && item.product_type !== 'service') {
      return success(countGuardResponseBody(Array.from(due.values())))
    }

    const price = customPrice ? Number(customPrice) : (Number(item.selling_rate) || 0)
    if (price <= 0) return badRequest('Invalid price')
    const lineAmount = price * qty

    const customerName = isGMC ? 'Grony Multimedia as Customer' : null
    let [receipt] = await sql`
      SELECT id FROM sales_receipts
      WHERE receipt_date::date = ${date} AND customer_name ${isGMC ? '=' : 'IS DISTINCT FROM'} ${customerName}
    `
    if (!receipt) {
      const receiptNumber = `APP-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
      try {
        [receipt] = await sql`
          INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source, entered_by)
          VALUES (${receiptNumber}, ${date}, ${customerName}, 0, 'live_sale', ${staffName})
          RETURNING id
        `
      } catch (e) {
        console.error('sales_receipts insert with entered_by failed, retrying without it:', e)
        ;[receipt] = await sql`
          INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source)
          VALUES (${receiptNumber}, ${date}, ${customerName}, 0, 'live_sale')
          RETURNING id
        `
      }
    }

    let [line] = await sql`
      UPDATE sales_receipt_lines
      SET quantity = quantity::numeric + ${qty}, item_total = item_total::numeric + ${lineAmount}
      WHERE receipt_id = ${receipt.id} AND item_id = ${item.id}
      RETURNING id, quantity, item_total
    `
    if (!line) {
      ;[line] = await sql`
        INSERT INTO sales_receipt_lines
          (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
        VALUES (${receipt.id}, ${item.id}, ${item.canonical_name}, ${item.canonical_name}, ${qty}, ${price}, ${lineAmount}, false, 'live_sale')
        RETURNING id, quantity, item_total
      `
    }

    await sql`
      UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id})
      WHERE id = ${receipt.id}
    `

    let soh: number | null = null
    try {
      const [itemData] = await sql`SELECT calculated_soh FROM item_stock_summary WHERE item_id = ${item.id}`
      if (itemData?.calculated_soh !== null && itemData?.calculated_soh !== undefined) {
        soh = parseFloat(itemData.calculated_soh)
      }
    } catch (e) {
      console.warn('Failed to fetch SOH:', e)
    }

    const [tap] = await sql`
      INSERT INTO live_sale_taps (item_id, item_name, price, staff_name, receipt_id, receipt_line_id, quantity, soh)
      VALUES (${item.id}, ${item.canonical_name}, ${price}, ${staffName}, ${receipt.id}, ${line.id}, ${qty}, ${soh})
      RETURNING id, item_id, item_name, price, staff_name, tapped_at, undone, quantity, soh
    `

    await logActivity(staffName, 'live sale tap', `${item.canonical_name} × ${qty} · ₵${lineAmount.toFixed(2)}`)
    console.log('[live-tap] Success, returning tap:', tap?.id)

    return success({ tap, lineQuantity: line.quantity, lineTotal: line.item_total })
  } catch (e) {
    console.error('[live-tap] Error:', e instanceof Error ? e.message : String(e))
    return handleError('sales/live-tap', e)
  }
}
