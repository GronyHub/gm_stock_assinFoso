import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

export async function GET() {
  // 1. Pre-Zoho Sales (raw sales names, item_id null or unresolved)
  const salesUnresolved = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt
    FROM sales_receipt_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
  ` as { name: string; cnt: number }[]
  const confirmedAliases = await sql`SELECT alias_name FROM item_aliases` as { alias_name: string }[]
  const confirmedSet = new Set(confirmedAliases.map(r => r.alias_name.toLowerCase().trim()))
  const salesPending = salesUnresolved.filter(r => !confirmedSet.has(r.name.toLowerCase().trim()))

  // 2. Pre-Zoho Bills
  const billsUnresolved = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt
    FROM bill_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
  ` as { name: string; cnt: number }[]
  const billsPending = billsUnresolved.filter(r => !confirmedSet.has(r.name.toLowerCase().trim()))

  // 3. Pre-Zoho Receipts (invoices)
  const receiptsUnresolved = await sql`
    SELECT raw_item_name AS name, COUNT(*)::int AS cnt
    FROM invoice_lines
    WHERE item_id IS NULL OR unresolved = true
    GROUP BY raw_item_name
  ` as { name: string; cnt: number }[]
  const receiptsPending = receiptsUnresolved.filter(r => !confirmedSet.has(r.name.toLowerCase().trim()))

  // 4. Flagged (already-resolved lines whose name semantically contradicts the item)
  const auditRows = await sql`
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
  ` as { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number }[]
  const flagged = auditRows
    .map(r => ({ ...r, warning: aliasMismatchWarning(r.raw_name, r.canonical_name) }))
    .filter((r): r is typeof r & { warning: string } => r.warning !== null)

  // 5. Ambiguous (alias_name -> multiple item_ids)
  const ambiguousGroups = await sql`
    SELECT LOWER(TRIM(alias_name)) AS norm_name, COUNT(DISTINCT item_id)::int AS n_items,
           STRING_AGG(DISTINCT item_id::text, ',') AS item_ids
    FROM item_aliases
    GROUP BY LOWER(TRIM(alias_name))
    HAVING COUNT(DISTINCT item_id) > 1
  `

  // 6. Unlinked (item_id null, but text matches an active item exactly)
  const unlinked = await sql`
    SELECT COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name, i.id AS item_id,
           COUNT(*)::int AS line_count
    FROM sales_receipt_lines srl
    JOIN items i ON LOWER(i.canonical_name) = LOWER(COALESCE(srl.resolved_name, srl.raw_item_name))
    WHERE srl.item_id IS NULL AND LOWER(i.status) = 'active'
    GROUP BY COALESCE(srl.resolved_name, srl.raw_item_name), i.id
  ` as { item_name: string; item_id: number; line_count: number }[]

  // Overlap check: which Pre-Zoho Sales pending names ALSO appear in Unlinked?
  const unlinkedNames = new Set(unlinked.map(r => r.item_name.toLowerCase().trim()))
  const overlapSalesUnlinked = salesPending.filter(r => unlinkedNames.has(r.name.toLowerCase().trim()))

  // Overlap: does a name appear in more than one of Sales/Bills/Receipts pending?
  const salesNames = new Set(salesPending.map(r => r.name.toLowerCase().trim()))
  const billsNames = new Set(billsPending.map(r => r.name.toLowerCase().trim()))
  const receiptsNames = new Set(receiptsPending.map(r => r.name.toLowerCase().trim()))
  const salesBillsOverlap = [...salesNames].filter(n => billsNames.has(n))
  const salesReceiptsOverlap = [...salesNames].filter(n => receiptsNames.has(n))
  const billsReceiptsOverlap = [...billsNames].filter(n => receiptsNames.has(n))

  return NextResponse.json({
    counts: {
      prezoho_sales: salesPending.length,
      prezoho_bills: billsPending.length,
      prezoho_receipts: receiptsPending.length,
      flagged: flagged.length,
      ambiguous: ambiguousGroups.length,
      unlinked: unlinked.length,
    },
    samples: {
      prezoho_sales: salesPending.slice(0, 10),
      prezoho_bills: billsPending.slice(0, 10),
      prezoho_receipts: receiptsPending.slice(0, 10),
      flagged: flagged.slice(0, 10),
      ambiguous: (ambiguousGroups as unknown[]).slice(0, 10),
      unlinked: unlinked.slice(0, 10),
    },
    overlaps: {
      sales_pending_that_are_also_unlinked: overlapSalesUnlinked,
      sales_bills_name_overlap: salesBillsOverlap,
      sales_receipts_name_overlap: salesReceiptsOverlap,
      bills_receipts_name_overlap: billsReceiptsOverlap,
    },
  })
}
