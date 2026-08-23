import sql from '@/lib/db'
import { recordCountRevision } from '@/lib/countRevisions'

// Merges loser into winner:
//   - loser's canonical_name → alias of winner
//   - loser's existing aliases → reassigned to winner
//   - sales_receipt_lines pointing to loser → winner
//   - bill_lines pointing to loser → winner
//   - stock-count history moved to winner (same-date conflicts keep the
//     winner's count, dropped loser count preserved as a deleted revision)
//   - anything converting into loser now converts into winner
//   - loser item marked Inactive
// If finalName is given and differs from winner's current name, the winner is
// renamed to it and its previous name is kept as an alias (so old receipts/
// aliases referencing either original name still resolve to the merged item).
export async function mergeItems(loserId: number, winnerId: number, finalName?: string, mergedBy?: string): Promise<{ merged: string; into: string }> {
  const [loser] = await sql`SELECT id, canonical_name FROM items WHERE id = ${loserId}`
  const [winner] = await sql`SELECT id, canonical_name FROM items WHERE id = ${winnerId}`
  if (!loser || !winner) throw new Error('Item not found')

  // Count data to be moved for audit trail
  const salesCount = await sql`SELECT COUNT(*) as cnt FROM sales_receipt_lines WHERE item_id = ${loserId}`
  const billsCount = await sql`SELECT COUNT(*) as cnt FROM bill_lines WHERE item_id = ${loserId}`
  const countsCount = await sql`SELECT COUNT(*) as cnt FROM stock_counts WHERE item_id = ${loserId}`
  const salesMoved = Number(salesCount[0]?.cnt ?? 0)
  const billsMoved = Number(billsCount[0]?.cnt ?? 0)
  const countsMoved = Number(countsCount[0]?.cnt ?? 0)

  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${winnerId}, ${loser.canonical_name}, 'canonical', 'merge')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `

  await sql`
    UPDATE item_aliases
    SET item_id = ${winnerId}
    WHERE item_id = ${loserId}
      AND NOT EXISTS (
        SELECT 1 FROM item_aliases x
        WHERE x.item_id = ${winnerId}
          AND x.alias_name = item_aliases.alias_name
          AND x.alias_type = item_aliases.alias_type
      )
  `
  await sql`DELETE FROM item_aliases WHERE item_id = ${loserId}`

  await sql`
    UPDATE sales_receipt_lines
    SET item_id = ${winnerId}, resolved_name = ${winner.canonical_name}
    WHERE item_id = ${loserId}
  `

  await sql`
    UPDATE bill_lines
    SET item_id = ${winnerId}, resolved_name = ${winner.canonical_name}
    WHERE item_id = ${loserId}
  `

  const conflicts = await sql`
    SELECT lc.id, lc.count_date::date::text AS d, lc.quantity_counted, lc.counted_by
    FROM stock_counts lc
    WHERE lc.item_id = ${loserId}
      AND EXISTS (
        SELECT 1 FROM stock_counts wc
        WHERE wc.item_id = ${winnerId} AND wc.count_date::date = lc.count_date::date
      )
  `
  for (const c of conflicts) {
    await recordCountRevision({
      stockCountId: c.id, itemId: winnerId, countDate: c.d,
      oldQty: c.quantity_counted, oldCountedBy: c.counted_by,
      changedBy: `merge of "${loser.canonical_name}"`, action: 'deleted',
    })
  }
  await sql`
    DELETE FROM stock_counts lc
    WHERE lc.item_id = ${loserId}
      AND EXISTS (
        SELECT 1 FROM stock_counts wc
        WHERE wc.item_id = ${winnerId} AND wc.count_date::date = lc.count_date::date
      )
  `
  await sql`
    UPDATE stock_counts SET item_id = ${winnerId}, item_name = ${winner.canonical_name}
    WHERE item_id = ${loserId}
  `

  await sql`UPDATE items SET converts_to_item_id = ${winnerId} WHERE converts_to_item_id = ${loserId}`

  await sql`UPDATE stock_count_revisions SET item_id = ${winnerId} WHERE item_id = ${loserId}`.catch(() => {})
  await sql`
    UPDATE pack_tradeoffs SET item_id = ${winnerId}
    WHERE item_id = ${loserId}
      AND NOT EXISTS (
        SELECT 1 FROM pack_tradeoffs x WHERE x.item_id = ${winnerId} AND x.row_date = pack_tradeoffs.row_date
      )
  `.catch(() => {})
  await sql`DELETE FROM pack_tradeoffs WHERE item_id = ${loserId}`.catch(() => {})

  // track_inventory=true alone is enough for item_stock_summary (and so the
  // main Items table) to keep showing a row regardless of status -- without
  // clearing it too, a merged-away loser can keep leaking into the main
  // list forever even though its data correctly moved to the winner.
  await sql`UPDATE items SET status = 'Inactive', track_inventory = false WHERE id = ${loserId}`

  const trimmedFinalName = typeof finalName === 'string' ? finalName.trim() : ''
  let finalMergedName = winner.canonical_name
  if (trimmedFinalName && trimmedFinalName !== winner.canonical_name) {
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${winnerId}, ${winner.canonical_name}, 'canonical', 'merge')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    await sql`
      UPDATE items SET canonical_name = ${trimmedFinalName}, zoho_item_name = ${trimmedFinalName}
      WHERE id = ${winnerId}
    `
    finalMergedName = trimmedFinalName
  }

  // Record merge in audit table for potential unmerge
  await sql`
    CREATE TABLE IF NOT EXISTS merge_audit (
      id SERIAL PRIMARY KEY,
      loser_id INTEGER NOT NULL,
      winner_id INTEGER NOT NULL,
      loser_original_name VARCHAR(255) NOT NULL,
      sales_moved_count INTEGER DEFAULT 0,
      bills_moved_count INTEGER DEFAULT 0,
      counts_moved_count INTEGER DEFAULT 0,
      merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      merged_by VARCHAR(255),
      reversed_at TIMESTAMP,
      UNIQUE(loser_id, winner_id, merged_at)
    )
  `.catch(() => {})

  await sql`
    INSERT INTO merge_audit (loser_id, winner_id, loser_original_name, sales_moved_count, bills_moved_count, counts_moved_count, merged_by)
    VALUES (${loserId}, ${winnerId}, ${loser.canonical_name}, ${salesMoved}, ${billsMoved}, ${countsMoved}, ${mergedBy})
  `.catch(() => {})

  return { merged: loser.canonical_name, into: finalMergedName }
}
