import sql from '@/lib/db'
import { once } from '@/lib/once'

// Bill-only extra costs (transport, bank charges, ...) that get apportioned
// across every item on that bill to arrive at each line's Adjusted Cost
// Price (ACP) -- deliberately unrelated to the `expenses` table for new
// entries (see /api/expenses/[id]/migrate-to-bill for moving an old
// `expenses` row over to this table instead of linking the two).
//
// `bill_id` points at one representative bill row for a (date, vendor)
// group -- BillsTab.tsx already groups the several `bills` rows that make
// up one real-world purchase this same way (one `bills` row per line item,
// same convention its own group-edit ✏️ already uses), so an expense
// entered against that representative id is shared across the whole group.
async function ensureBillExpensesTableImpl() {
  await sql`
    CREATE TABLE IF NOT EXISTS bill_expenses (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      description TEXT,
      amount NUMERIC NOT NULL,
      migrated_from_expense_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS bill_expenses_bill_id_idx ON bill_expenses(bill_id)`.catch(() => {})
}

export const ensureBillExpensesTable = once(ensureBillExpensesTableImpl)

// Every item with a bill_lines row anywhere in the (date, vendor) group
// `billId` belongs to -- the full set an added/removed bill_expenses row
// against that group's representative id could affect, so callers can pass
// this straight to lib/vcpSync.ts's syncAcpForItems.
export async function getItemIdsInBillGroup(billId: number): Promise<number[]> {
  const rows = await sql`
    SELECT DISTINCT bl.item_id
    FROM bill_lines bl
    JOIN bills b ON b.id = bl.bill_id
    JOIN bills vb ON vb.id = ${billId}
    WHERE b.bill_date = vb.bill_date
      AND COALESCE(b.vendor_name, '') = COALESCE(vb.vendor_name, '')
      AND b.source IS DISTINCT FROM 'live_sale'
      AND bl.item_id IS NOT NULL
  ` as { item_id: number }[]
  return rows.map(r => r.item_id)
}
