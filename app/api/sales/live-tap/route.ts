import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { ensureLiveSaleTapsTable } from '@/lib/liveSales'
import { NextRequest, NextResponse } from 'next/server'

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
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await req.json()
  if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })

  const staffName = session.user?.name || (session.user as { username?: string })?.username || 'Unknown'
  const date = todayStr()

  try {
    await ensureLiveSaleTapsTable()

    const [item] = await sql`SELECT id, canonical_name, selling_rate FROM items WHERE id = ${Number(itemId)}`
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    const price = Number(item.selling_rate) || 0

    let [receipt] = await sql`
      SELECT id FROM sales_receipts
      WHERE receipt_date::date = ${date} AND customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
    `
    if (!receipt) {
      const receiptNumber = `APP-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
      ;[receipt] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source, entered_by)
        VALUES (${receiptNumber}, ${date}, NULL, 0, 'live_sale', ${staffName})
        RETURNING id
      `
    }

    let [line] = await sql`
      UPDATE sales_receipt_lines
      SET quantity = quantity::numeric + 1, item_total = item_total::numeric + ${price}
      WHERE receipt_id = ${receipt.id} AND item_id = ${item.id}
      RETURNING id, quantity, item_total
    `
    if (!line) {
      ;[line] = await sql`
        INSERT INTO sales_receipt_lines
          (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
        VALUES (${receipt.id}, ${item.id}, ${item.canonical_name}, ${item.canonical_name}, 1, ${price}, ${price}, false, 'live_sale')
        RETURNING id, quantity, item_total
      `
    }

    await sql`
      UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id})
      WHERE id = ${receipt.id}
    `

    const [tap] = await sql`
      INSERT INTO live_sale_taps (item_id, item_name, price, staff_name, receipt_id, receipt_line_id)
      VALUES (${item.id}, ${item.canonical_name}, ${price}, ${staffName}, ${receipt.id}, ${line.id})
      RETURNING id, item_id, item_name, price, staff_name, tapped_at, undone
    `

    await logActivity(staffName, 'live sale tap', `${item.canonical_name} · ₵${price.toFixed(2)}`)

    return NextResponse.json({ tap, lineQuantity: line.quantity, lineTotal: line.item_total })
  } catch (e) {
    console.error('live-tap POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not record tap: ${detail}` }, { status: 500 })
  }
}
