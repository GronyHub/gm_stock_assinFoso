import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // An alias "leaking" into the canonical item list: alias_name matches
    // some item's canonical_name, but that item is NOT the one the alias
    // actually points to -- i.e. the alias text also exists as its own,
    // separate real item, which is exactly the kind of near-duplicate this
    // session has been cleaning up all along.
    const leaks = await sql`
      SELECT a.id AS alias_id, a.alias_name, a.alias_type, a.source AS alias_source,
             a.item_id AS aliased_to_item_id, ai.canonical_name AS aliased_to_item_name,
             i.id AS conflicting_item_id, i.canonical_name AS conflicting_item_name, i.status AS conflicting_item_status
      FROM item_aliases a
      JOIN items i ON LOWER(TRIM(i.canonical_name)) = LOWER(TRIM(a.alias_name)) AND i.id != a.item_id
      JOIN items ai ON ai.id = a.item_id
      ORDER BY a.alias_name
    `
    return NextResponse.json({ count: leaks.length, leaks })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
