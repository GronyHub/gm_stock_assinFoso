import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Aliases only backfill matching lines at the moment they're created or
// moved (see /api/aliases/confirm and /api/aliases/[id] PATCH) -- nothing
// re-applies them to lines that show up afterward (a later import using the
// same raw text, or a stale `unresolved` flag that never got cleared). This
// re-runs every existing alias against current sales/bill lines so that gap
// doesn't require manually re-discovering and re-confirming names that are
// already mapped.
export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // An alias_name that maps to more than one distinct item is ambiguous --
  // skip it rather than guess which item wins (the unique constraint on
  // item_aliases is (item_id, alias_name, alias_type), so the same name can
  // legitimately point at different items under different rows).
  const ambiguousRows = await sql`
    SELECT LOWER(TRIM(alias_name)) AS norm_name
    FROM item_aliases
    GROUP BY LOWER(TRIM(alias_name))
    HAVING COUNT(DISTINCT item_id) > 1
  ` as { norm_name: string }[]
  const ambiguousNames = ambiguousRows.map(r => r.norm_name)

  const salesUpdated = await sql`
    UPDATE sales_receipt_lines s
    SET item_id = a.item_id, resolved_name = i.canonical_name, unresolved = false
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(s.raw_item_name)) = LOWER(TRIM(a.alias_name))
      AND LOWER(TRIM(a.alias_name)) <> ALL(${ambiguousNames})
      AND (s.item_id IS DISTINCT FROM a.item_id OR s.unresolved = true)
    RETURNING s.id
  `
  const billsUpdated = await sql`
    UPDATE bill_lines b
    SET item_id = a.item_id, resolved_name = i.canonical_name, unresolved = false
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(b.raw_item_name)) = LOWER(TRIM(a.alias_name))
      AND LOWER(TRIM(a.alias_name)) <> ALL(${ambiguousNames})
      AND (b.item_id IS DISTINCT FROM a.item_id OR b.unresolved = true)
    RETURNING b.id
  `

  return NextResponse.json({
    salesLinesUpdated: salesUpdated.length,
    billLinesUpdated: billsUpdated.length,
    ambiguousNamesSkipped: ambiguousNames,
  })
}
