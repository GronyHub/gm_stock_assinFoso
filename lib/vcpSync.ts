import sql from '@/lib/db'
import { once } from '@/lib/once'

async function ensureAdjustedCostPriceColumnImpl() {
  await sql`ALTER TABLE items ADD COLUMN IF NOT EXISTS adjusted_cost_price NUMERIC`.catch(() => {})
}
export const ensureAdjustedCostPriceColumn = once(ensureAdjustedCostPriceColumnImpl)

// items.purchase_rate (VCP -- Vendor Cost Price) is no longer manually
// typed: it mirrors the most recent real bill's unit_price for that item.
// Call this after any bill_lines insert/delete that could change which line
// is "most recent" for an item (new app-entered bill, PO receipt, bill
// delete). `live_sale` bills are /api/sales/live-tap's own internal stock
// adjustments, not real purchases, so they're excluded here same as
// everywhere else that reasons about "real" bills.
export async function syncVcpForItems(itemIds: (number | null | undefined)[]) {
  const ids = Array.from(new Set(itemIds.filter((id): id is number => id != null)))
  if (ids.length === 0) return

  await sql`
    UPDATE items
    SET purchase_rate = NULL
    WHERE id = ANY(${ids})
      AND NOT EXISTS (
        SELECT 1 FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = items.id
          AND b.source IS DISTINCT FROM 'live_sale'
          AND bl.unit_price IS NOT NULL
      )
  `.catch(() => {})

  await sql`
    UPDATE items i
    SET purchase_rate = latest.unit_price
    FROM (
      SELECT DISTINCT ON (bl.item_id) bl.item_id, bl.unit_price
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id = ANY(${ids})
        AND b.source IS DISTINCT FROM 'live_sale'
        AND bl.unit_price IS NOT NULL
      ORDER BY bl.item_id, b.bill_date DESC, bl.id DESC
    ) latest
    WHERE i.id = latest.item_id
  `.catch(() => {})

  await syncAcpForItems(ids)
}

// items.adjusted_cost_price caches "today's ACP" (VCP + the current source
// bill's apportioned Shared Expenses) so hot, whole-catalogue reads like
// /api/items/all can just read a column instead of re-deriving it with
// LATERAL joins on every fetch. Recomputed here (write time) rather than at
// read time -- call after anything that could change it: a VCP resync
// above, or a bill_expenses row being added to/removed from a group (see
// lib/billExpenses.ts's getItemIdsInBillGroup).
export async function syncAcpForItems(itemIds: (number | null | undefined)[]) {
  const ids = Array.from(new Set(itemIds.filter((id): id is number => id != null)))
  if (ids.length === 0) return
  await ensureAdjustedCostPriceColumn()

  await sql`
    UPDATE items i
    SET adjusted_cost_price = calc.acp
    FROM (
      SELECT i2.id AS item_id,
        COALESCE(i2.purchase_rate, 0) + CASE WHEN grp.total_qty > 0 THEN COALESCE(be.total, 0) / grp.total_qty ELSE 0 END AS acp
      FROM items i2
      LEFT JOIN LATERAL (
        SELECT bl.bill_id
        FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = i2.id
          AND b.source IS DISTINCT FROM 'live_sale'
          AND bl.unit_price IS NOT NULL
        ORDER BY b.bill_date DESC, bl.id DESC
        LIMIT 1
      ) latest_bill ON true
      LEFT JOIN LATERAL (
        SELECT MAX(b1.id) AS rep_id, SUM(bl1.quantity) AS total_qty
        FROM bills b1
        JOIN bill_lines bl1 ON bl1.bill_id = b1.id
        JOIN bills vb ON vb.id = latest_bill.bill_id
        WHERE b1.bill_date = vb.bill_date
          AND COALESCE(b1.vendor_name, '') = COALESCE(vb.vendor_name, '')
          AND b1.source IS DISTINCT FROM 'live_sale'
      ) grp ON true
      LEFT JOIN LATERAL (
        SELECT SUM(amount) AS total FROM bill_expenses WHERE bill_id = grp.rep_id
      ) be ON true
      WHERE i2.id = ANY(${ids})
    ) calc
    WHERE i.id = calc.item_id
  `.catch(() => {})
}
