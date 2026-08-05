import sql from '@/lib/db'

// A running wishlist of future purchases the shop is still deciding on --
// separate from the real expenses table, since nothing here has actually
// been bought yet. expense_name and vendor_name are both free text (backed
// by a datalist of existing items/vendors in the UI, but never forced to
// match one) since a wanted item or vendor may not exist in either list yet.
export async function ensureExpenseOrders() {
  await sql`
    CREATE TABLE IF NOT EXISTS expense_orders (
      id SERIAL PRIMARY KEY,
      expense_name TEXT NOT NULL,
      vendor_name TEXT,
      price NUMERIC,
      notes TEXT,
      entered_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}
