import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Temporary tool for undoing a mislink: finds sales_receipt_lines currently
// linked to `wrongItemName` whose original raw_item_name suggests they
// actually belong to something else (matches `nameContains`), within an
// optional date range. GET previews the affected rows; POST clears their
// item_id AND resolved_name (falling back to the original raw_item_name),
// putting them back in the "Unlinked" flag under their real name instead of
// the wrong one, ready to be reviewed and relinked deliberately.
async function findMismatches(wrongItemName: string, nameContains: string, from: string | null, to: string | null) {
  return sql`
    SELECT sr.id AS receipt_id, sr.receipt_number, sr.receipt_date::text AS receipt_date,
           sr.customer_name, srl.id AS line_id, srl.raw_item_name, srl.resolved_name,
           srl.item_id, srl.quantity, srl.item_price
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    JOIN items i ON i.id = srl.item_id
    WHERE LOWER(i.canonical_name) = LOWER(${wrongItemName})
      AND srl.raw_item_name ILIKE ${'%' + nameContains + '%'}
      AND (${from}::date IS NULL OR sr.receipt_date::date >= ${from}::date)
      AND (${to}::date IS NULL OR sr.receipt_date::date <= ${to}::date)
    ORDER BY sr.receipt_date
  `
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const wrongItemName = searchParams.get('wrongItemName')
  const nameContains = searchParams.get('nameContains')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!wrongItemName || !nameContains) {
    return NextResponse.json({ error: 'wrongItemName and nameContains query params required' }, { status: 400 })
  }

  const rows = await findMismatches(wrongItemName, nameContains, from, to)
  return NextResponse.json({ count: rows.length, rows })
}

// Acts on an explicit set of line ids (whatever the caller selected from a
// preview), not a re-run of the search -- so a user can act on just some of
// the matched rows, and so the set acted on is exactly what was reviewed,
// even if the underlying data shifted between preview and apply.
// If correctItemName is given, the lines are moved straight to that item
// (item_id + resolved_name set directly) instead of just being unlinked --
// skipping the generic Unlinked-flag text-match entirely, so there's no
// chance of the same kind of mismatch happening again on relink.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { lineIds, correctItemName } = await req.json()
  if (!Array.isArray(lineIds) || lineIds.length === 0) {
    return NextResponse.json({ error: 'lineIds required' }, { status: 400 })
  }
  const ids = lineIds.map(Number).filter((n: number) => Number.isFinite(n))

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'

  if (correctItemName) {
    const [correctItem] = await sql`
      SELECT id, canonical_name FROM items
      WHERE LOWER(canonical_name) = LOWER(${correctItemName}) AND LOWER(status) = 'active'
    `
    if (!correctItem) return NextResponse.json({ error: `No active item named "${correctItemName}"` }, { status: 404 })

    await sql`
      UPDATE sales_receipt_lines
      SET item_id = ${correctItem.id}, resolved_name = ${correctItem.canonical_name}, unresolved = false
      WHERE id = ANY(${ids})
    `
  } else {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = NULL, resolved_name = NULL, unresolved = true
      WHERE id = ANY(${ids})
    `
  }

  const action = correctItemName ? `moved to "${correctItemName}"` : 'unlinked'
  await logActivity(actor, correctItemName ? 'relinked mismatched sales lines' : 'unlinked mismatched sales lines',
    `${ids.length} line${ids.length !== 1 ? 's' : ''} ${action}`)

  return NextResponse.json({ ok: true, updated: ids.length })
}
