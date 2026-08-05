import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const TWELVE = [383, 328, 177, 273, 260, 257, 101, 244, 205, 384, 117, 340]

export async function GET() {
  // Direct check against the items table itself -- closes the gap where my
  // earlier check skipped 'items' and relied on the active_items view,
  // which only catches references from OTHER ACTIVE items, not inactive
  // ones pointing at one of these 12 via converts_to_item_id/service_item_id.
  const selfRefs = await sql`
    SELECT id, canonical_name, status,
      converts_to_item_id, service_item_id, canonical_item_id, zoho_item_id
    FROM items
    WHERE converts_to_item_id = ANY(${TWELVE})
       OR service_item_id = ANY(${TWELVE})
       OR canonical_item_id = ANY(${TWELVE})
  `

  // Also re-verify the 12 have no incoming item_aliases (someone could have
  // added one since the last check) and no outgoing aliases of their own
  // that would be lost.
  const aliasRefs = await sql`
    SELECT id, item_id, alias_name FROM item_aliases WHERE item_id = ANY(${TWELVE})
  `

  // Final fresh re-check across every real transaction/activity table, run
  // again right now (not from the earlier snapshot) to catch anything new.
  const fresh = await sql`
    SELECT 'sales_receipt_lines' AS tbl, item_id, COUNT(*)::int AS cnt FROM sales_receipt_lines WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'bill_lines', item_id, COUNT(*)::int FROM bill_lines WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'invoice_lines', item_id, COUNT(*)::int FROM invoice_lines WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'stock_counts', item_id, COUNT(*)::int FROM stock_counts WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'closer_counts', item_id, COUNT(*)::int FROM closer_counts WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'inventory_adjustment_lines', item_id, COUNT(*)::int FROM inventory_adjustment_lines WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'purchase_order_lines', item_id, COUNT(*)::int FROM purchase_order_lines WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'live_sale_taps', item_id, COUNT(*)::int FROM live_sale_taps WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'item_transaction_history', item_id, COUNT(*)::int FROM item_transaction_history WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'stock_count_revisions', item_id, COUNT(*)::int FROM stock_count_revisions WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'item_stock_summary', item_id, COUNT(*)::int FROM item_stock_summary WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'pack_tradeoffs', item_id, COUNT(*)::int FROM pack_tradeoffs WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'item_audio_advert_status', item_id, COUNT(*)::int FROM item_audio_advert_status WHERE item_id = ANY(${TWELVE}) GROUP BY item_id
    UNION ALL
    SELECT 'dismissed_duplicates_1', item_id1, COUNT(*)::int FROM dismissed_duplicates WHERE item_id1 = ANY(${TWELVE}) GROUP BY item_id1
    UNION ALL
    SELECT 'dismissed_duplicates_2', item_id2, COUNT(*)::int FROM dismissed_duplicates WHERE item_id2 = ANY(${TWELVE}) GROUP BY item_id2
  `

  // Actual FK constraint check -- does postgres itself enforce any of these,
  // meaning a bad delete would fail loudly instead of silently orphaning?
  const constraints = await sql`
    SELECT
      tc.table_name, kcu.column_name, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'items'
    ORDER BY tc.table_name
  `

  return NextResponse.json({ selfRefs, aliasRefs, fresh, constraints })
}
