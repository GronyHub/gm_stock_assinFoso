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

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { wrongItemName, nameContains, from, to } = await req.json()
  if (!wrongItemName || !nameContains) {
    return NextResponse.json({ error: 'wrongItemName and nameContains required' }, { status: 400 })
  }

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  const rows = await findMismatches(wrongItemName, nameContains, from ?? null, to ?? null)
  const lineIds = rows.map((r: any) => r.line_id)

  if (lineIds.length > 0) {
    await sql`
      UPDATE sales_receipt_lines
      SET item_id = NULL, resolved_name = NULL, unresolved = true
      WHERE id = ANY(${lineIds})
    `
  }

  await logActivity(actor, 'unlinked mismatched sales lines',
    `${lineIds.length} line${lineIds.length !== 1 ? 's' : ''} removed from "${wrongItemName}" (matched "${nameContains}")`)

  return NextResponse.json({ ok: true, unlinked: lineIds.length })
}
