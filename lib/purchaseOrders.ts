import sql from '@/lib/db'

// Purchase Orders -- a request sent to a vendor for goods not yet received,
// distinct from a Bill (which records a purchase already made). A PO stays
// open until its lines are received; each "Receive Items" action creates a
// real Bill for exactly what arrived in that batch (supporting partial
// deliveries -- an order can be received across several dates/bills before
// every line is fully accounted for) and links it back via
// purchase_order_receipts. Line-level detail for a given receiving batch is
// read from that Bill's own bill_lines rather than duplicated here.
export async function ensurePurchaseOrderTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      po_number TEXT NOT NULL UNIQUE,
      vendor_id INTEGER REFERENCES vendors(id),
      vendor_name TEXT,
      order_date DATE NOT NULL,
      expected_date DATE,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_order_lines (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      item_id INTEGER REFERENCES items(id),
      item_name TEXT NOT NULL,
      qty_ordered NUMERIC NOT NULL,
      qty_received NUMERIC NOT NULL DEFAULT 0,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS purchase_order_receipts (
      id SERIAL PRIMARY KEY,
      po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      bill_id INTEGER REFERENCES bills(id),
      received_date DATE NOT NULL,
      received_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}

// Receiving progress is derived from the lines rather than stored, so it
// can never drift out of sync with what's actually been received.
export type ReceivingState = 'not_started' | 'partial' | 'complete'

export function receivingState(lines: { qty_ordered: number; qty_received: number }[]): ReceivingState {
  if (lines.length === 0) return 'not_started'
  const allComplete = lines.every(l => l.qty_received >= l.qty_ordered - 0.001)
  if (allComplete) return 'complete'
  const anyStarted = lines.some(l => l.qty_received > 0.001)
  return anyStarted ? 'partial' : 'not_started'
}
