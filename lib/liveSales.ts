import sql from '@/lib/db'

// One row per tap -- never merged, never hard-deleted (see `undone`) --
// so a receipt line's aggregated quantity can always be decomposed back
// into exactly who tapped what and when. `receipt_id`/`receipt_line_id`
// point at the sales_receipts/sales_receipt_lines row the tap fed into,
// so undoing a tap knows exactly which line to decrement.
export async function ensureLiveSaleTapsTable() {
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
      receipt_line_id INTEGER
    )
  `.catch(() => {})
}
