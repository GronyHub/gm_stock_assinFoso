import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { aliasMismatchWarning } from '@/lib/aliasSanity'
import { NextResponse } from 'next/server'

// Scans every already-matched raw name (sales + bills) for the same class
// of mistake that caused the A4 Brown Envelope Pack investigation: a raw
// name that says "singles" matched to a "pack" item, or vice versa. This
// doesn't require anything new to happen -- it's a one-shot check over
// what's already been confirmed, so existing bad matches (made before this
// sanity check existed) can be found and fixed.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const rows = await sql`
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
  `

  const flagged = (rows as { raw_name: string; item_id: number; canonical_name: string; source: string; cnt: number }[])
    .map(r => ({ ...r, warning: aliasMismatchWarning(r.raw_name, r.canonical_name) }))
    .filter((r): r is typeof r & { warning: string } => r.warning !== null)

  return NextResponse.json(flagged)
}
