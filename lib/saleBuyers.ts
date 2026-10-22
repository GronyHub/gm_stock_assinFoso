import sql from '@/lib/db'
import { once } from '@/lib/once'
import { normalizeGhPhone, ensureCustomerProfileColumns } from '@/lib/customerProfile'

// Who bought what, per sales-log receipt. Written by the Live Sale GM box (one row per
// tap that names a customer or phone number) and by customer receipts. It lets the Sales
// Log show the buyer under the day's receipt, create a customer from a phone number,
// and send the WhatsApp message later.
export const ensureSaleBuyers = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS sale_buyers (
    id SERIAL PRIMARY KEY, receipt_id INTEGER, tap_id INTEGER, invoice_id INTEGER,
    item_id INTEGER, item_name TEXT NOT NULL, qty NUMERIC NOT NULL DEFAULT 1, price NUMERIC NOT NULL DEFAULT 0,
    customer_id_code TEXT, customer_name TEXT, customer_phone TEXT,
    source TEXT NOT NULL DEFAULT 'live_sale', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS sale_buyers_receipt ON sale_buyers (receipt_id)`.catch(() => {})
})

export async function recordBuyer(b: {
  receiptId: number | null; tapId?: number | null; invoiceId?: number | null; itemId?: number | null
  itemName: string; qty: number; price: number
  customerIdCode?: string | null; customerName?: string | null; customerPhone?: string | null
  source: 'live_sale' | 'receipt'; createdBy?: string | null
}): Promise<number | null> {
  try {
    await ensureSaleBuyers()
    const [row] = await sql`INSERT INTO sale_buyers
      (receipt_id, tap_id, invoice_id, item_id, item_name, qty, price, customer_id_code, customer_name, customer_phone, source, created_by)
      VALUES (${b.receiptId}, ${b.tapId ?? null}, ${b.invoiceId ?? null}, ${b.itemId ?? null}, ${b.itemName}, ${b.qty}, ${b.price},
              ${b.customerIdCode ?? null}, ${b.customerName ?? null}, ${normalizeGhPhone(b.customerPhone)}, ${b.source}, ${b.createdBy ?? null})
      RETURNING id`
    return row.id as number
  } catch (e) { console.error('recordBuyer:', e instanceof Error ? e.message : String(e)); return null }
}

// Saves a person as a customer from a phone number (+ name) and returns their GM number.
export async function createCustomerFromPhone(name: string, phoneRaw: string, addedBy: string | null, source = 'sales_log'): Promise<{ id: number; code: string } | null> {
  const phone = normalizeGhPhone(phoneRaw)
  if (!phone || !name.trim()) return null
  await ensureCustomerProfileColumns()
  const clean = name.trim().slice(0, 80)
  const first = clean.split(/\s+/)[0]
  const last = clean.split(/\s+/).slice(1).join(' ') || null
  const [row] = await sql`
    INSERT INTO customers (display_name, first_name, last_name, phone, status, is_internal, source, opening_balance, added_by)
    VALUES (${clean}, ${first}, ${last}, ${phone}, 'Active', false, ${source}, 0, ${addedBy})
    RETURNING id`
  const code = `GM${row.id}`
  await sql`UPDATE customers SET customer_id_code = ${code} WHERE id = ${row.id}`
  return { id: row.id as number, code }
}
