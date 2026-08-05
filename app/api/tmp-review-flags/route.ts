import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const [
    unresolvedBills,
    unresolvedSales,
    unresolvedReceipts,
    flaggedAudit,
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
    // Mirrors /api/aliases/audit's row count (flagged) -- best-effort, this
    // endpoint's logic is JS-side (aliasMismatchWarning), so just count
    // resolved lines with a resolved alias source for a sanity figure.
    sql`SELECT COUNT(*)::int AS cnt FROM item_aliases`,
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

  return NextResponse.json({
    unresolvedBills: { count: unresolvedBills.length, rows: unresolvedBills },
    unresolvedSales: { count: unresolvedSales.length },
    unresolvedReceipts: { count: unresolvedReceipts.length },
    itemAliasesTotal: flaggedAudit[0]?.cnt,
    ambiguousGroups: { count: ambiguousGroups.length, rows: ambiguousGroups },
    nameConflicts: { count: leaks.length, rows: leaks },
    noVendorBills: { count: noVendorBills.length },
    noItemsBills: { count: noItemsBills.length },
  })
}
