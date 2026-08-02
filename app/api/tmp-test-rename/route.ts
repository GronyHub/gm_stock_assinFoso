import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const ITEM_ID = 121 // 26A Toner Cartridge

export async function POST() {
  const [before] = await sql`SELECT canonical_name FROM items WHERE id = ${ITEM_ID}`
  const originalName = before.canonical_name
  const testName = originalName + ' (TEST RENAME)'

  // Replicates exactly what PUT /api/items/[id] now does
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${ITEM_ID}, ${originalName}, 'canonical', 'rename')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  await sql`UPDATE items SET canonical_name = ${testName} WHERE id = ${ITEM_ID}`

  const aliasesAfterRename = await sql`
    SELECT alias_name, alias_type, source FROM item_aliases WHERE item_id = ${ITEM_ID} AND source = 'rename'
  `

  // Revert: rename back, then remove the test alias so nothing real is left behind
  await sql`UPDATE items SET canonical_name = ${originalName} WHERE id = ${ITEM_ID}`
  await sql`DELETE FROM item_aliases WHERE item_id = ${ITEM_ID} AND source = 'rename' AND alias_name = ${originalName}`

  const [after] = await sql`SELECT canonical_name FROM items WHERE id = ${ITEM_ID}`
  const aliasesAfterRevert = await sql`SELECT alias_name FROM item_aliases WHERE item_id = ${ITEM_ID} AND source = 'rename'`

  return NextResponse.json({
    originalName, testName,
    aliasCreatedDuringRename: aliasesAfterRename,
    nameAfterRevert: after.canonical_name,
    aliasesLeftAfterCleanup: aliasesAfterRevert,
  })
}
