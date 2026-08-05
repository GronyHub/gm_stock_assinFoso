import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function GET() {
  const [
    unresolvedBills,
    unresolvedSales,
    unresolvedReceipts,
    auditRows,
    ambiguousGroups,
    leaks,
    noVendorBills,
    noItemsBills,
  ] = await Promise.all([
    // Mirrors /api/aliases/unresolved-bills (post no-items-bills exclusion)
    sql`
      SELECT bl.raw_item_name AS name, COUNT(*)::int AS cnt
      FROM bill_lines bl
      JOIN bills b ON b.id = bl.bill_id
      WHERE (bl.item_id IS NULL OR bl.unresolved = true)
        AND NOT (
          COALESCE(b.total, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM bill_lines bl2 WHERE bl2.bill_id = b.id AND bl2.item_id IS NOT NULL)
        )
      GROUP BY bl.raw_item_name
      ORDER BY COUNT(*) DESC
    `,
    // Mirrors /api/aliases/unresolved (sales)
    sql`
      SELECT raw_item_name AS name, COUNT(*)::int AS cnt
      FROM sales_receipt_lines
      WHERE item_id IS NULL OR unresolved = true
      GROUP BY raw_item_name
      ORDER BY COUNT(*) DESC
    `,
    // Mirrors /api/aliases/unresolved-receipts
    sql`
      SELECT raw_item_name AS name, COUNT(*)::int AS cnt
      FROM invoice_lines
      WHERE item_id IS NULL OR unresolved = true
      GROUP BY raw_item_name
      ORDER BY COUNT(*) DESC
    `.catch(() => []),
    // Exact query from /api/aliases/audit (pre-filter, filtered below)
    sql`
      SELECT raw_name, item_id, canonical_name, source, SUM(cnt)::int AS cnt FROM (
        SELECT srl.raw_item_name AS raw_name, srl.item_id, i.canonical_name, 'sales' AS source, COUNT(*)::int AS cnt
        FROM sales_receipt_lines srl
        JOIN items i ON i.id = srl.item_id
        WHERE srl.raw_item_name IS NOT NULL AND TRIM(srl.raw_item_name) <> ''
        GROUP BY srl.raw_item_name, srl.item_id, i.canonical_name
        UNION ALL
        SELECT bl.raw_item_name, bl.item_id, i.canonical_name, 'bills', COUNT(*)::int
        FROM bill_lines bl
        JOIN items i ON i.id = bl.item_id
        WHERE bl.raw_item_name IS NOT NULL AND TRIM(bl.raw_item_name) <> ''
        GROUP BY bl.raw_item_name, bl.item_id, i.canonical_name
      ) combined
      GROUP BY raw_name, item_id, canonical_name, source
      ORDER BY cnt DESC
    `,
    sql`
      SELECT LOWER(TRIM(alias_name)) AS norm_name, COUNT(DISTINCT item_id)::int AS distinct_items
      FROM item_aliases
      GROUP BY LOWER(TRIM(alias_name))
      HAVING COUNT(DISTINCT item_id) > 1
    `,
    sql`
      SELECT a.id AS alias_id, a.alias_name, a.item_id AS aliased_to_item_id, i2.id AS conflicting_item_id
      FROM item_aliases a
      JOIN items i2 ON LOWER(i2.canonical_name) = LOWER(a.alias_name) AND i2.id != a.item_id
    `.catch(() => []),
    sql`SELECT id FROM bills WHERE vendor_name IS NULL OR TRIM(vendor_name) = ''`,
    sql`
      SELECT id, bill_number, vendor_name, bill_date::text AS bill_date, total
      FROM bills b
      WHERE COALESCE(b.total, 0) > 0
        AND NOT EXISTS (SELECT 1 FROM bill_lines bl WHERE bl.bill_id = b.id AND bl.item_id IS NOT NULL)
    `,
  ])

  const flagged = (auditRows as { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number }[])
    .map(r => ({ ...r, warning: aliasMismatchWarning(r.raw_name, r.canonical_name) }))
    .filter((r): r is typeof r & { warning: string } => r.warning !== null)
  const dismissedFlagged = await sql`SELECT review_key FROM dismissed_alias_reviews WHERE review_type = 'flagged'`.catch(() => [])
  const dismissedFlaggedKeys = new Set((dismissedFlagged as { review_key: string }[]).map(r => r.review_key))
  const visibleFlagged = flagged.filter(r => !dismissedFlaggedKeys.has(`${r.source}::${r.raw_name}::${r.item_id}`))

  return NextResponse.json({
    unresolvedBills: { count: unresolvedBills.length, rows: unresolvedBills },
    unresolvedSales: { count: unresolvedSales.length },
    unresolvedReceipts: { count: unresolvedReceipts.length, rows: unresolvedReceipts },
    flagged: { count: visibleFlagged.length, rows: visibleFlagged },
    ambiguousGroups: { count: ambiguousGroups.length, rows: ambiguousGroups },
    nameConflicts: { count: leaks.length, rows: leaks },
    noVendorBills: { count: noVendorBills.length },
    noItemsBills: { count: noItemsBills.length },
  })
}
