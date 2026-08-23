import sql from '@/lib/db'

// Reverses a merge operation, restoring the loser item as a canonical item
// with all its original data. Note: any data added to the winner after the
// merge will remain with the winner.
export async function unmergeItems(loserId: number, winnerId: number): Promise<{ restored: string; from: string }> {
  // Verify the merge exists and hasn't been reversed
  const [audit] = await sql`
    SELECT id, loser_original_name, sales_moved_count, bills_moved_count, counts_moved_count
    FROM merge_audit
    WHERE loser_id = ${loserId} AND winner_id = ${winnerId} AND reversed_at IS NULL
    ORDER BY merged_at DESC
    LIMIT 1
  `
  if (!audit) throw new Error('Merge not found or already reversed')

  const [loser] = await sql`SELECT id, canonical_name, status FROM items WHERE id = ${loserId}`
  const [winner] = await sql`SELECT id, canonical_name FROM items WHERE id = ${winnerId}`
  if (!loser || !winner) throw new Error('Item not found')

  // Revert sales_receipt_lines back to loser
  if (audit.sales_moved_count > 0) {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${loserId}, resolved_name = ${audit.loser_original_name}
      WHERE item_id = ${winnerId}
        AND resolved_name = ${winner.canonical_name}
      LIMIT ${audit.sales_moved_count}
    `
  }

  // Revert bill_lines back to loser
  if (audit.bills_moved_count > 0) {
    await sql`
      UPDATE bill_lines
      SET item_id = ${loserId}, resolved_name = ${audit.loser_original_name}
      WHERE item_id = ${winnerId}
        AND resolved_name = ${winner.canonical_name}
      LIMIT ${audit.bills_moved_count}
    `
  }

  // Revert stock_counts back to loser
  if (audit.counts_moved_count > 0) {
    await sql`
      UPDATE stock_counts
      SET item_id = ${loserId}, item_name = ${audit.loser_original_name}
      WHERE item_id = ${winnerId}
        AND item_name = ${winner.canonical_name}
      LIMIT ${audit.counts_moved_count}
    `
  }

  // Revert stock_count_revisions
  await sql`
    UPDATE stock_count_revisions
    SET item_id = ${loserId}
    WHERE item_id = ${winnerId} AND item_name = ${winner.canonical_name}
  `.catch(() => {})

  // Revert pack_tradeoffs if they were merged
  await sql`
    UPDATE pack_tradeoffs
    SET item_id = ${loserId}
    WHERE item_id = ${winnerId}
  `.catch(() => {})

  // Restore loser's original canonical_name and mark as Active
  await sql`
    UPDATE items
    SET canonical_name = ${audit.loser_original_name}, zoho_item_name = ${audit.loser_original_name}, status = NULL, track_inventory = true
    WHERE id = ${loserId}
  `

  // Remove loser's name from winner's aliases (if it was added during merge)
  await sql`
    DELETE FROM item_aliases
    WHERE item_id = ${winnerId} AND alias_name = ${audit.loser_original_name} AND alias_type = 'canonical' AND source = 'merge'
  `

  // Mark merge as reversed in audit
  await sql`
    UPDATE merge_audit
    SET reversed_at = CURRENT_TIMESTAMP
    WHERE id = ${audit.id}
  `

  return { restored: audit.loser_original_name, from: winner.canonical_name }
}
