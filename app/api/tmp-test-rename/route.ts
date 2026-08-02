import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const ITEM_ID = 121 // 26A Toner Cartridge

export async function GET() {
  const aliases = await sql`SELECT alias_name, alias_type, source FROM item_aliases WHERE item_id = ${ITEM_ID}`
  return NextResponse.json({ aliases })
}

export async function POST() {
  const [before] = await sql`SELECT canonical_name FROM items WHERE id = ${ITEM_ID}`
  const realName = before.canonical_name
  // A synthetic "current name" guaranteed to have no pre-existing alias of
  // its own, so the INSERT path is actually exercised instead of no-oping
  // against an alias that already existed from the original import.
  const syntheticName = realName + ' [TEST-A]'
  const syntheticName2 = realName + ' [TEST-B]'

  await sql`UPDATE items SET canonical_name = ${syntheticName} WHERE id = ${ITEM_ID}`

  // Replicates exactly what PUT /api/items/[id] now does: insert the
  // (synthetic) old name as an alias, then rename.
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${ITEM_ID}, ${syntheticName}, 'canonical', 'rename')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `
  await sql`UPDATE items SET canonical_name = ${syntheticName2} WHERE id = ${ITEM_ID}`

  const aliasCreated = await sql`
    SELECT alias_name, alias_type, source FROM item_aliases
    WHERE item_id = ${ITEM_ID} AND alias_name = ${syntheticName}
  `

  // Full cleanup -- restore the real name, remove every synthetic alias
  await sql`UPDATE items SET canonical_name = ${realName} WHERE id = ${ITEM_ID}`
  await sql`DELETE FROM item_aliases WHERE item_id = ${ITEM_ID} AND alias_name IN (${syntheticName}, ${syntheticName2})`

  const [after] = await sql`SELECT canonical_name FROM items WHERE id = ${ITEM_ID}`
  const leftoverSynthetic = await sql`
    SELECT alias_name FROM item_aliases WHERE item_id = ${ITEM_ID} AND alias_name LIKE ${'%[TEST-%'}
  `

  return NextResponse.json({
    realName, syntheticName, syntheticName2,
    aliasCreatedForSyntheticOldName: aliasCreated,
    nameAfterCleanup: after.canonical_name,
    leftoverSyntheticAliasesAfterCleanup: leftoverSynthetic,
  })
}
