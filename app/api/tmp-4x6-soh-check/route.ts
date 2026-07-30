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
    const counts = item.length
      ? await sql`SELECT id, count_date, quantity, notes, source, created_at FROM stock_counts WHERE item_id = ${item[0].id} ORDER BY count_date DESC, id DESC LIMIT 20`
      : []
    let summary = null
    try {
      summary = item.length ? await sql`SELECT * FROM item_stock_summary WHERE item_id = ${item[0].id}` : []
    } catch (e) {
      summary = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
    return NextResponse.json({ item, viewDef, counts, summary })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
