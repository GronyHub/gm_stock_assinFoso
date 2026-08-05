import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const REF_TABLES: { table: string; col: string }[] = [
  { table: 'sales_receipt_lines', col: 'item_id' },
  { table: 'bill_lines', col: 'item_id' },
  { table: 'invoice_lines', col: 'item_id' },
  { table: 'stock_counts', col: 'item_id' },
  { table: 'closer_counts', col: 'item_id' },
  { table: 'inventory_adjustment_lines', col: 'item_id' },
  { table: 'purchase_order_lines', col: 'item_id' },
  { table: 'live_sale_taps', col: 'item_id' },
  { table: 'item_transaction_history', col: 'item_id' },
  { table: 'stock_count_revisions', col: 'item_id' },
  { table: 'item_stock_summary', col: 'item_id' },
  { table: 'pack_tradeoffs', col: 'item_id' },
  { table: 'item_audio_advert_status', col: 'item_id' },
  { table: 'item_aliases', col: 'item_id' },
]

export async function POST(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'
  // Fresh leaks list, right now, not from an earlier snapshot.
  const leaks = await sql`
    SELECT DISTINCT ON (LOWER(TRIM(a.alias_name)), i.id)
      a.id AS alias_id, a.alias_name,
      a.item_id AS aliased_to_item_id, ai.canonical_name AS aliased_to_item_name,
      i.id AS conflicting_item_id, i.canonical_name AS conflicting_item_name, i.status AS conflicting_item_status
    FROM item_aliases a
    JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
    JOIN items ai ON ai.id = a.item_id
    WHERE NOT EXISTS (
      SELECT 1 FROM dismissed_alias_reviews d WHERE d.review_type = 'name_conflict' AND d.review_key = a.id::text
    )
    ORDER BY LOWER(TRIM(a.alias_name)), i.id, a.id
  ` as { alias_id: number; alias_name: string; aliased_to_item_id: number; aliased_to_item_name: string; conflicting_item_id: number; conflicting_item_name: string; conflicting_item_status: string | null }[]

  const inactiveIds = Array.from(new Set(leaks.filter(r => r.conflicting_item_status === 'Inactive').map(r => r.conflicting_item_id)))

  // Fresh zero-reference check across every real table, right now.
  const refCounts: Record<number, number> = {}
  for (const id of inactiveIds) refCounts[id] = 0
  for (const { table, col } of REF_TABLES) {
    const rows = await sql`
      SELECT ${sql.unsafe(col)} AS item_id, COUNT(*)::int AS cnt
      FROM ${sql.unsafe(table)}
      WHERE ${sql.unsafe(col)} = ANY(${inactiveIds})
      GROUP BY ${sql.unsafe(col)}
    ` as { item_id: number; cnt: number }[]
    for (const r of rows) refCounts[r.item_id] = (refCounts[r.item_id] ?? 0) + r.cnt
  }
  // Also check the items table's own self-referencing columns.
  const selfRefRows = await sql`
    SELECT converts_to_item_id, service_item_id, canonical_item_id
    FROM items
    WHERE converts_to_item_id = ANY(${inactiveIds}) OR service_item_id = ANY(${inactiveIds}) OR canonical_item_id = ANY(${inactiveIds})
  ` as { converts_to_item_id: number | null; service_item_id: number | null; canonical_item_id: number | null }[]
  for (const r of selfRefRows) {
    for (const v of [r.converts_to_item_id, r.service_item_id, r.canonical_item_id]) {
      if (v != null && v in refCounts) refCounts[v] += 1
    }
  }

  const deletableIds = inactiveIds.filter(id => (refCounts[id] ?? 0) === 0)
  const dismissOnlyIds = inactiveIds.filter(id => (refCounts[id] ?? 0) > 0)

  // Dismiss the alias-conflict review for every Inactive-conflict row whose
  // item was NOT deleted (has real refs elsewhere) -- explicitly excludes
  // null-status conflicts (#369, #372-style: real, currently-used items
  // that need a human business-judgment call, not auto-dismissal) and
  // Active-status conflicts (never included, per conflicting_item_status
  // = 'Inactive' filter above).
  const toDismiss = leaks.filter(r => r.conflicting_item_status === 'Inactive' && dismissOnlyIds.includes(r.conflicting_item_id))

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      deletableIds, deletableCount: deletableIds.length,
      deletableRows: leaks.filter(r => deletableIds.includes(r.conflicting_item_id)),
      toDismissCount: toDismiss.length,
      toDismiss,
      heldBack: leaks.filter(r => r.conflicting_item_status !== 'Inactive'),
    })
  }

  // Delete the truly-zero-reference items.
  const deleted = deletableIds.length > 0
    ? await sql`DELETE FROM items WHERE id = ANY(${deletableIds}) RETURNING id, canonical_name`
    : []

  await sql`
    CREATE TABLE IF NOT EXISTS dismissed_alias_reviews (
      review_type TEXT NOT NULL, review_key TEXT NOT NULL, dismissed_by TEXT,
      dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (review_type, review_key)
    )
  `.catch(() => {})

  const dismissedRows: { alias_id: number; alias_name: string; conflicting_item_name: string }[] = []
  for (const r of toDismiss) {
    await sql`
      INSERT INTO dismissed_alias_reviews (review_type, review_key, dismissed_by)
      VALUES ('name_conflict', ${String(r.alias_id)}, 'Claude (automated cleanup)')
      ON CONFLICT (review_type, review_key) DO NOTHING
    `
    dismissedRows.push({ alias_id: r.alias_id, alias_name: r.alias_name, conflicting_item_name: r.conflicting_item_name })
  }

  const heldBack = leaks.filter(r => r.conflicting_item_status !== 'Inactive')

  return NextResponse.json({
    deletedCount: deleted.length,
    deleted,
    dismissedCount: dismissedRows.length,
    dismissed: dismissedRows,
    heldBackCount: heldBack.length,
    heldBack: heldBack.map(r => ({ alias_name: r.alias_name, conflicting_item_name: r.conflicting_item_name, status: r.conflicting_item_status })),
  })
}
