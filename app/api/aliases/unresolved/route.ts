import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  // A plain LEFT JOIN on normalized alias_name fans out one row per matching
  // alias -- harmless for a name with 0 or 1 matches, but a name that matches
  // more than one alias row (exactly what /api/aliases/ambiguous exists to
  // flag) came back as duplicate rows here instead of one. A correlated
  // EXISTS keeps this to a single query while guaranteeing one row per name.
  const rows = await sql`
    SELECT srl.raw_item_name AS name, COUNT(*)::int AS cnt,
           EXISTS (
             SELECT 1 FROM item_aliases ia
             WHERE LOWER(TRIM(ia.alias_name)) = LOWER(TRIM(srl.raw_item_name))
           ) AS confirmed
    FROM sales_receipt_lines srl
    WHERE srl.item_id IS NULL OR srl.unresolved = true
    GROUP BY srl.raw_item_name
    ORDER BY COUNT(*) DESC
  `

  return NextResponse.json(rows)
}
