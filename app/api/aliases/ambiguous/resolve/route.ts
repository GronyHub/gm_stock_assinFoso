import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Resolves one ambiguous alias name either by keeping one candidate item or,
// when keep_item_id is omitted, by deleting every row for the name -- for
// the case where no candidate has any sales/bill lines actually resolved to
// it, so there's nothing to pick between and the name is just orphaned old
// data.
//
// Keeping a candidate does two things, not just one: it deletes the
// item_aliases rows for the losing candidate(s) (so the name maps to a
// single item again for future confirms/resweeps), AND it moves any
// sales_receipt_lines/bill_lines that are *currently* resolved to a losing
// candidate via this exact raw text over to the winner -- otherwise those
// lines stay silently mis-resolved even though the alias table looks clean.
// This is the same backfill /api/aliases/[id] PATCH does when moving a
// single alias, just scoped to the losing candidates of one ambiguous name.
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { norm_name, keep_item_id } = await req.json()
  if (!norm_name) return NextResponse.json({ error: 'norm_name required' }, { status: 400 })

  if (!keep_item_id) {
    const deleted = await sql`
      DELETE FROM item_aliases
      WHERE LOWER(TRIM(alias_name)) = ${norm_name}
      RETURNING id
    `
    return NextResponse.json({ ok: true, deletedCount: deleted.length, salesLinesMoved: 0, billLinesMoved: 0 })
  }

  const [winner] = await sql`SELECT canonical_name FROM items WHERE id = ${keep_item_id}`
  if (!winner) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  const losers = await sql`
    SELECT DISTINCT item_id FROM item_aliases
    WHERE LOWER(TRIM(alias_name)) = ${norm_name} AND item_id <> ${keep_item_id}
  ` as { item_id: number }[]
  const loserIds = losers.map(r => r.item_id)

  const salesMoved = loserIds.length
    ? await sql`
        UPDATE sales_receipt_lines
        SET item_id = ${keep_item_id}, resolved_name = ${winner.canonical_name}, unresolved = false
        WHERE LOWER(TRIM(raw_item_name)) = ${norm_name} AND item_id = ANY(${loserIds})
        RETURNING id
      `
    : []
  const billsMoved = loserIds.length
    ? await sql`
        UPDATE bill_lines
        SET item_id = ${keep_item_id}, resolved_name = ${winner.canonical_name}, unresolved = false
        WHERE LOWER(TRIM(raw_item_name)) = ${norm_name} AND item_id = ANY(${loserIds})
        RETURNING id
      `
    : []

  const deleted = await sql`
    DELETE FROM item_aliases
    WHERE LOWER(TRIM(alias_name)) = ${norm_name}
      AND item_id <> ${keep_item_id}
    RETURNING id
  `

  return NextResponse.json({
    ok: true,
    deletedCount: deleted.length,
    salesLinesMoved: salesMoved.length,
    billLinesMoved: billsMoved.length,
  })
}
