import sql from '@/lib/db'
import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

// loser -> winner, exact canonical_name matches only (same pattern as A4
// SHEETS DOUBLE A). The 3 ambiguous ones (117, 205, 273) are deliberately
// excluded -- no exact-name active match, or real activity that needs a
// human decision, not a guess.
const MERGES: [number, number][] = [
  [76, 265],   // Advance Ink 100ml - Magenta
  [81, 295],   // Advance Ink 250ml - Magenta
  [82, 262],   // Advance Ink 250ml - Light Magenta
  [267, 77],   // Advance Ink 100ml - Light  Magenta
  [276, 9],    // A4 210 grams
  [371, 278],  // A4 Photo Paper Singles
]

export async function POST() {
  const results = []
  for (const [loserId, winnerId] of MERGES) {
    const before = await sql`
      SELECT i.id, i.canonical_name, i.status, s.calculated_soh
      FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.id IN (${loserId}, ${winnerId})
    `
    try {
      const result = await mergeItems(loserId, winnerId)
      const after = await sql`
        SELECT i.id, i.canonical_name, i.status, s.calculated_soh
        FROM items i LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE i.id IN (${loserId}, ${winnerId})
      `
      results.push({ loserId, winnerId, before, result, after })
    } catch (e) {
      results.push({ loserId, winnerId, before, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json(results)
}
