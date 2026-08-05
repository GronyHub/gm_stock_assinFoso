import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// (alias_name, aliased_to_item_id) pairs already dismissed once -- this
// finds any SIBLING item_aliases rows sharing the same normalized text and
// same target item (different alias_id -- e.g. one 'canonical' + one
// 'sr_variant', or a zoho_historical/zoho_backfill duplicate pair) that
// weren't caught the first time, since dismissal is keyed by alias_id and
// the leaks query's DISTINCT ON just surfaces the next-lowest sibling once
// the first is hidden.
const PAIRS: { name: string; itemId: number }[] = [
  { name: ' A3 Brown Env  single - alias', itemId: 198 },
  { name: 'A3 BROWN ENVELOPE SINGLES', itemId: 198 },
  { name: 'A4 210 GRAMS', itemId: 9 },
  { name: 'A4 Brown Envelope singles for sale 2', itemId: 367 },
  { name: 'A4 Photo Paper Singles', itemId: 278 },
  { name: 'A4 SHEETS DOUBLE A', itemId: 4 },
  { name: 'Advance Ink 100ml - Light  Magenta', itemId: 77 },
  { name: 'old stop - White Envelope (DL) Singles', itemId: 319 },
  { name: 'old- stop-  A4 Brown Envelope Singles', itemId: 367 },
  { name: 'old- stop- 5 X 7 Singles For Pictures - old (to be deleted)', itemId: 374 },
  { name: 'old- stop- A4 180 singles', itemId: 12 },
  { name: 'old- stop- A4 260 D singles for Inv. Cards', itemId: 278 },
  { name: 'old- stop- A4 260g S for shop use', itemId: 278 },
  { name: 'old- stop- A4 Lamination Singles', itemId: 315 },
  { name: 'old- stop- ID Lamination singles', itemId: 345 },
  { name: 'old- stop- Passport records (old)', itemId: 373 },
  { name: 'Passport Printing (4x6)', itemId: 373 },
  { name: 'Picture Printing (5x7)', itemId: 374 },
  { name: 'PVC Cover Singles', itemId: 282 },
]

export async function POST() {
  const already = await sql`SELECT review_key FROM dismissed_alias_reviews WHERE review_type = 'name_conflict'` as { review_key: string }[]
  const alreadySet = new Set(already.map(r => r.review_key))

  const newlyDismissed: { alias_id: number; alias_name: string; item_id: number }[] = []
  for (const p of PAIRS) {
    const siblings = await sql`
      SELECT id, alias_name, item_id FROM item_aliases
      WHERE LOWER(TRIM(alias_name)) = LOWER(TRIM(${p.name})) AND item_id = ${p.itemId}
    ` as { id: number; alias_name: string; item_id: number }[]
    for (const s of siblings) {
      if (alreadySet.has(String(s.id))) continue
      await sql`
        INSERT INTO dismissed_alias_reviews (review_type, review_key, dismissed_by)
        VALUES ('name_conflict', ${String(s.id)}, 'Claude (automated cleanup, sibling pass)')
        ON CONFLICT (review_type, review_key) DO NOTHING
      `
      newlyDismissed.push({ alias_id: s.id, alias_name: s.alias_name, item_id: s.item_id })
      alreadySet.add(String(s.id))
    }
  }

  return NextResponse.json({ newlyDismissedCount: newlyDismissed.length, newlyDismissed })
}
