import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Every one of the 7 ambiguous pairs has the same shape: one side is a
// zero-activity "service" item I just renamed (its OLD "Service - X" name
// got preserved as a self-referential alias), the other is the real,
// actively-used item that already correctly resolved that exact text
// beforehand. Deleting the dead item's own rename-artifact alias resolves
// the ambiguity in favor of the item real sales history already points to.
const DELETE_ALIAS_IDS = [
  2198, // item 307 (0 sales) -- keep alias on 367 (298 sales)
  2220, // item 101 (0 sales) -- keep alias on 342 (177 sales)
  2218, // item 244 (0 sales) -- keep alias on 342 (177 sales)
  2241, // item 304 (0 sales) -- keep alias on 373 (780 sales)
  2223, // item 306 (0 sales) -- keep alias on 374 (102 sales)
  2239, // item 320 (0 sales) -- keep alias on 319 (73 sales)
  2233, // item 340 (0 sales) -- keep alias on 319 (73 sales)
]

export async function POST() {
  const results = []
  for (const id of DELETE_ALIAS_IDS) {
    const [row] = await sql`DELETE FROM item_aliases WHERE id = ${id} RETURNING id, item_id, alias_name`
    results.push(row ?? { id, error: 'not found' })
  }

  const remainingAmbiguous = await sql`
    SELECT LOWER(TRIM(alias_name)) AS norm_name, COUNT(DISTINCT item_id)::int AS n_items
    FROM item_aliases
    GROUP BY LOWER(TRIM(alias_name))
    HAVING COUNT(DISTINCT item_id) > 1
  `
  return NextResponse.json({ deleted: results, remainingAmbiguousCount: remainingAmbiguous.length, remainingAmbiguous })
}
