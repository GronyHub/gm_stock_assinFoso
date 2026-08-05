import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

// The 7 dead duplicates from the ambiguous-alias cleanup, each merged into
// the real active item its alias already correctly pointed to.
const MERGES: { loser: number; winner: number }[] = [
  { loser: 307, winner: 367 }, // A4 Brown Envelope singles
  { loser: 101, winner: 342 }, // Online registration - School Admission -> Online reg'n
  { loser: 244, winner: 342 }, // Online Registration - Security Forces -> Online reg'n
  { loser: 304, winner: 373 }, // Passport Printing (4x6) -> 4x6 Photo Paper Singles
  { loser: 306, winner: 374 }, // Picture Printing (5x7) -> 5x7 Photo Paper Singles
  { loser: 320, winner: 319 }, // white dl envelope singles -> White envelope DL singles _for sale
  { loser: 340, winner: 319 }, // White envelope DL singles _for envelope printing -> _for sale
]

export async function POST() {
  const results = []
  for (const { loser, winner } of MERGES) {
    try {
      const r = await mergeItems(loser, winner)
      results.push({ loser, winner, ok: true, ...r })
    } catch (e) {
      results.push({ loser, winner, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }
  return NextResponse.json({ results })
}
