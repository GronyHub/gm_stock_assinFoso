import sql from '@/lib/db'
import { once } from '@/lib/once'

// One row per tap -- never merged, never hard-deleted (see `undone`) --
// so a receipt line's aggregated quantity can always be decomposed back
// into exactly who tapped what and when. `receipt_id`/`receipt_line_id`
// point at the sales_receipts/sales_receipt_lines row the tap fed into,
// so undoing a tap knows exactly which line to decrement.
async function ensureLiveSaleTapsTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS live_sale_taps (
      id SERIAL PRIMARY KEY,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      price NUMERIC NOT NULL,
      staff_name TEXT NOT NULL,
      tapped_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      undone BOOLEAN NOT NULL DEFAULT FALSE,
      receipt_id INTEGER,
      receipt_line_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 1
    )
  `.catch(() => {})
  // Quantity-preset buttons (e.g. tapping "20" for a batch of passport
  // photos) came after the table already existed in some environments --
  // this backfills it on those without touching any existing row's data.
  await sql`ALTER TABLE live_sale_taps ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1`.catch(() => {})
  // Stock-on-hand snapshot at time of tap
  await sql`ALTER TABLE live_sale_taps ADD COLUMN IF NOT EXISTS soh NUMERIC`.catch(() => {})
  // Tracks whether undoing this tap has actually been backed out of
  // sales_receipt_lines yet -- undone alone used to mean that (see below),
  // but for a while `undone = true` was set without ever touching the
  // receipt line, so a batch of already-undone taps exist whose line was
  // never decremented. This lets /api/sales/live-taps/reconcile find
  // exactly those (undone but not yet reversed) without re-reversing taps
  // the fixed undo handler already corrected.
  await sql`ALTER TABLE live_sale_taps ADD COLUMN IF NOT EXISTS receipt_reversed BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
  // Customer ID code (e.g., GM0001) for tracking which customer did the work
  await sql`ALTER TABLE live_sale_taps ADD COLUMN IF NOT EXISTS customer_id_code TEXT`.catch(() => {})
  // The customer receipt (invoices.id) this tap was issued on, when it was sold through MI (multiple items).
  await sql`ALTER TABLE live_sale_taps ADD COLUMN IF NOT EXISTS invoice_id INTEGER`.catch(() => {})
  await sql`ALTER TABLE invoice_lines ADD COLUMN IF NOT EXISTS tap_id INTEGER`.catch(() => {})
  // Every tap recorded before this column existed was undone (if at all)
  // through the old handler that never reversed the receipt line -- so on
  // the very first run after adding this column, an undone/unreversed row
  // always means "genuinely not reversed yet," never "reversed before this
  // column existed." Taps that are NOT undone are correctly left FALSE
  // (default) since they were never meant to be reversed at all.
}

export const ensureLiveSaleTapsTable = once(ensureLiveSaleTapsTableImpl)

// Backs out exactly one tap's own contribution to the receipt line it fed
// into (several taps can share one line, so this only subtracts this tap's
// quantity/amount, not the whole line) and recalculates the receipt total.
// Shared by the per-tap undo endpoint and the one-off reconciliation sweep
// for taps that were undone before undo actually did this.
export async function reverseTapReceiptEffect(tap: {
  item_id: number
  quantity: number
  price: number | string
  receipt_id: number | null
  receipt_line_id: number | null
}) {
  if (tap.receipt_line_id) {
    const lineAmount = Number(tap.price) * Number(tap.quantity)
    const [updatedLine] = await sql`
      UPDATE sales_receipt_lines
      SET quantity = quantity::numeric - ${tap.quantity}, item_total = item_total::numeric - ${lineAmount}
      WHERE id = ${tap.receipt_line_id}
      RETURNING quantity
    `
    if (updatedLine && Number(updatedLine.quantity) <= 0) {
      await sql`DELETE FROM sales_receipt_lines WHERE id = ${tap.receipt_line_id}`
    }
  }
  if (tap.receipt_id) {
    await sql`
      UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id})
      WHERE id = ${tap.receipt_id}
    `
  }

  // Best-effort reversal of the GMC "material consumption" bill line a
  // service-using-GMC tap creates (see /api/sales/live-tap) -- there's no
  // stored link back to the exact bill_lines row it made, so this matches
  // the most recent same-item, same-quantity negative line as a reasonable
  // stand-in. Never blocks the caller on failure.
  try {
    const [item] = await sql`
      SELECT product_type, gmc_type, converts_to_item_id FROM items WHERE id = ${tap.item_id}
    `
    if (item?.product_type === 'service' && item.gmc_type === 'service_using_gmc' && item.converts_to_item_id) {
      await sql`
        DELETE FROM bill_lines WHERE id = (
          SELECT bl.id FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE b.vendor_name = 'Internal Consumption'
            AND bl.item_id = ${item.converts_to_item_id}
            AND bl.quantity = ${-tap.quantity}
          ORDER BY bl.id DESC LIMIT 1
        )
      `
    }
  } catch (e) {
    console.error('[reverseTapReceiptEffect] Failed to reverse GMC consumption line:', e)
  }
}

// Re-files a sale (tap) on the day receipts after it is edited: its old amount comes off the receipt line it was on,
// and its new amount goes onto the receipt for the day it now falls on (found or created the same way a new sale
// does, keeping walk-in and GMC receipts apart). Receipt lines group every sale of one item on one day, so an edit
// must only change that sale's share -- the old code overwrote the whole line with the one sale's numbers, and a
// sale moved to another day stayed on the old day's receipt. Touches receipt lines only (not stock or bills).
export async function refileTapOnReceipts(tap: {
  id: number; item_id: number; item_name: string
  receipt_id: number | null; receipt_line_id: number | null
}, old: { qty: number; price: number }, now: { qty: number; price: number; tappedAt: string | Date }, staffName?: string | null) {
  if (!tap.receipt_id) return
  const [oldReceipt] = await sql`SELECT customer_name, receipt_date::date::text AS d FROM sales_receipts WHERE id = ${tap.receipt_id}`
  if (!oldReceipt) return
  // 1. take the old amount off its line
  if (tap.receipt_line_id) {
    const [line] = await sql`
      UPDATE sales_receipt_lines
      SET quantity = quantity::numeric - ${old.qty}, item_total = item_total::numeric - ${old.qty * old.price}
      WHERE id = ${tap.receipt_line_id}
      RETURNING quantity
    `
    if (line && Number(line.quantity) <= 0) await sql`DELETE FROM sales_receipt_lines WHERE id = ${tap.receipt_line_id}`
  }
  await sql`UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id}) WHERE id = ${tap.receipt_id}`

  // 2. the receipt for the day the sale now falls on (Ghana is UTC all year)
  const day = new Date(now.tappedAt).toISOString().slice(0, 10)
  const customerName = (oldReceipt.customer_name as string | null) ?? null
  let receiptId: number = tap.receipt_id
  if (day !== oldReceipt.d) {
    const [found] = customerName === null
      ? await sql`SELECT id FROM sales_receipts WHERE receipt_date::date = ${day} AND customer_name IS NULL ORDER BY id LIMIT 1`
      : await sql`SELECT id FROM sales_receipts WHERE receipt_date::date = ${day} AND customer_name = ${customerName} ORDER BY id LIMIT 1`
    if (found) receiptId = Number(found.id)
    else {
      const receiptNumber = `APP-${day.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
      const [created] = await sql`
        INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source, entered_by)
        VALUES (${receiptNumber}, ${day}, ${customerName}, 0, 'live_sale', ${staffName ?? null})
        RETURNING id`
      receiptId = Number(created.id)
    }
  }

  // 3. add the new amount to that receipt's line for the item
  const amount = now.qty * now.price
  let [line] = await sql`
    UPDATE sales_receipt_lines
    SET quantity = quantity::numeric + ${now.qty}, item_total = item_total::numeric + ${amount}
    WHERE id = (SELECT id FROM sales_receipt_lines WHERE receipt_id = ${receiptId} AND item_id = ${tap.item_id} ORDER BY id LIMIT 1)
    RETURNING id
  `
  if (!line) {
    ;[line] = await sql`
      INSERT INTO sales_receipt_lines
        (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
      VALUES (${receiptId}, ${tap.item_id}, ${tap.item_name}, ${tap.item_name}, ${now.qty}, ${now.price}, ${amount}, false, 'live_sale')
      RETURNING id`
  }
  await sql`UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receiptId}) WHERE id = ${receiptId}`
  await sql`UPDATE live_sale_taps SET receipt_id = ${receiptId}, receipt_line_id = ${line.id} WHERE id = ${tap.id}`
}
