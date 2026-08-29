import sql from '@/lib/db'

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
}
