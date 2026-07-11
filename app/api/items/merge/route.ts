import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// POST { loser_id, winner_id, final_name? }
// Merges loser into winner:
//   - loser's canonical_name → alias of winner
//   - loser's existing aliases → reassigned to winner
//   - sales_receipt_lines pointing to loser → winner
//   - bill_lines pointing to loser → winner
//   - loser item marked Inactive
// If final_name is given and differs from winner's current name, the winner is
// renamed to it and its previous name is kept as an alias (so old receipts/aliases
// referencing either original name still resolve to the merged item).
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { loser_id, winner_id, final_name } = await req.json()
  if (!loser_id || !winner_id || loser_id === winner_id)
    return NextResponse.json({ error: 'Invalid ids' }, { status: 400 })

  const [loser]  = await sql`SELECT id, canonical_name FROM items WHERE id = ${loser_id}`
  const [winner] = await sql`SELECT id, canonical_name FROM items WHERE id = ${winner_id}`
  if (!loser || !winner)
    return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  // 1. Add loser's canonical_name as alias of winner
  await sql`
    INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
    VALUES (${winner_id}, ${loser.canonical_name}, 'canonical', 'merge')
    ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
  `

  // 2. Move loser's aliases to winner (skip any that already exist on winner)
  await sql`
    UPDATE item_aliases
    SET item_id = ${winner_id}
    WHERE item_id = ${loser_id}
      AND NOT EXISTS (
        SELECT 1 FROM item_aliases x
        WHERE x.item_id = ${winner_id}
          AND x.alias_name = item_aliases.alias_name
          AND x.alias_type = item_aliases.alias_type
      )
  `
  // Delete any remaining duplicates on loser
  await sql`DELETE FROM item_aliases WHERE item_id = ${loser_id}`

  // 3. Reassign sales_receipt_lines
  await sql`
    UPDATE sales_receipt_lines
    SET item_id = ${winner_id}, resolved_name = ${winner.canonical_name}
    WHERE item_id = ${loser_id}
  `

  // 4. Reassign bill_lines
  await sql`
    UPDATE bill_lines
    SET item_id = ${winner_id}, resolved_name = ${winner.canonical_name}
    WHERE item_id = ${loser_id}
  `

  // 5. Mark loser as Inactive
  await sql`UPDATE items SET status = 'Inactive' WHERE id = ${loser_id}`

  // 6. Optionally rename the winner to a name that's neither original name
  const trimmedFinalName = typeof final_name === 'string' ? final_name.trim() : ''
  let finalName = winner.canonical_name
  if (trimmedFinalName && trimmedFinalName !== winner.canonical_name) {
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${winner_id}, ${winner.canonical_name}, 'canonical', 'merge')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    await sql`
      UPDATE items SET canonical_name = ${trimmedFinalName}, zoho_item_name = ${trimmedFinalName}
      WHERE id = ${winner_id}
    `
    finalName = trimmedFinalName
  }

  return NextResponse.json({
    ok: true,
    merged: loser.canonical_name,
    into: finalName,
  })
}
