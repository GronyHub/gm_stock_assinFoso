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
