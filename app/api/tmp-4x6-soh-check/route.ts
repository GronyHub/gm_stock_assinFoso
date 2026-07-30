import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const item = await sql`
      SELECT id, canonical_name, opening_stock, opening_stock_value, stock_on_hand, track_inventory
      FROM items WHERE canonical_name ILIKE '%4x6%photo%' OR canonical_name ILIKE '%4x6%'
    `
    let viewDef = null
    try {
      const vd = await sql`SELECT pg_get_viewdef('item_stock_summary', true) AS def`
      viewDef = vd[0]?.def ?? null
    } catch (e) {
      viewDef = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
    const stockCountsCols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'stock_counts' ORDER BY ordinal_position
    `
    const counts = item.length
      ? await sql`SELECT * FROM stock_counts WHERE item_id = ${item[0].id} ORDER BY id DESC LIMIT 20`
      : []
    let summary = null
    try {
      summary = item.length ? await sql`SELECT * FROM item_stock_summary WHERE item_id = ${item[0].id}` : []
    } catch (e) {
      summary = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
    const packRelations = await sql`
      SELECT id, canonical_name, converts_to_item_id, units_per_pack, track_inventory
      FROM items WHERE converts_to_item_id = 373 OR id = 373
    `
    const aliases = await sql`SELECT id, item_id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 373`
    return NextResponse.json({ item, viewDef, stockCountsCols, counts, summary, packRelations, aliases })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
