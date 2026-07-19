import sql from '@/lib/db'
import { mergeItems } from '@/lib/mergeItems'
import { NextRequest, NextResponse } from 'next/server'

// One-time fix, requested and confirmed by the user:
//  - reactivate 5 real items wrongly left Inactive/null-status
//  - merge their empty duplicate rows into them
// Gated by a query param so it can't fire by accident; removed once run.
const REACTIVATE_IDS = [200, 262, 295, 9, 367]
const MERGE_PAIRS: [loser: number, winner: number][] = [
  [177, 200], // A4 230 grams
  [82, 262],  // Advance Ink 250ml - Light Magenta
  [81, 295],  // Advance Ink 250ml - Magenta
  [260, 295], // Advance Ink 250ml - Magenta
  [276, 9],   // A4 210 grams
]

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('confirm') !== 'yes-fix-items') {
    return NextResponse.json({ error: 'Add ?confirm=yes-fix-items to run this.' }, { status: 400 })
  }

  const reactivated = await sql`
    UPDATE items SET status = 'Active' WHERE id = ANY(${REACTIVATE_IDS})
    RETURNING id, canonical_name, status
  `

  const merges = []
  for (const [loserId, winnerId] of MERGE_PAIRS) {
    try {
      const result = await mergeItems(loserId, winnerId)
      merges.push({ loserId, winnerId, ...result })
    } catch (e) {
      merges.push({ loserId, winnerId, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({ reactivated, merges })
}
