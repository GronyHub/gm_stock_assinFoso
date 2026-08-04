import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  // The 10 items renamed earlier, plus item 353 (renamed to 'A4 sticker 2')
  // -- confirm their CURRENT canonical_name.
  const renamedIds = [344, 346, 322, 348, 349, 345, 352, 341, 343, 339, 353]
  const renamedNow = await sql`SELECT id, canonical_name, status FROM items WHERE id = ANY(${renamedIds}) ORDER BY id`

  // Broad, fresh search: anything currently starting with "Service" in any
  // form, no assumptions about a specific separator this time.
  const stillService = await sql`
    SELECT id, canonical_name, status FROM items
    WHERE canonical_name ILIKE 'service%'
    ORDER BY canonical_name
  `

  return NextResponse.json({ renamedNow, stillServiceCount: stillService.length, stillService })
}
