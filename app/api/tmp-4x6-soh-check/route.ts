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
    const counts = await sql`SELECT * FROM stock_counts WHERE item_id = 373 ORDER BY id DESC LIMIT 20`
    let summary = null
    try {
      summary = await sql`SELECT * FROM item_stock_summary WHERE item_id = 373`
    } catch (e) {
      summary = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
    const packRelations = await sql`
      SELECT id, canonical_name, converts_to_item_id, units_per_pack, track_inventory
      FROM items WHERE converts_to_item_id = 373 OR id = 373
    `
    const aliases = await sql`SELECT id, item_id, alias_name, alias_type, source FROM item_aliases WHERE item_id = 373`
    // Full count history for the pack item (id 2) and singles item (id 373),
    // plus sales/bills lines against any of the 4 related items, to trace
    // through the pack-chain SOH calc that LossTab.tsx does client-side.
    const packCounts = await sql`SELECT * FROM stock_counts WHERE item_id = 2 ORDER BY count_date DESC, id DESC LIMIT 30`
    const relatedIds = [2, 373, 304, 305]
    const salesLines = await sql`
      SELECT srl.id, srl.item_id, srl.quantity, srl.item_price, srl.item_total, sr.receipt_date
      FROM sales_receipt_lines srl JOIN sales_receipts sr ON sr.id = srl.receipt_id
      WHERE srl.item_id = ANY(${relatedIds})
      ORDER BY sr.receipt_date DESC LIMIT 30
    `
    const billLines = await sql`
      SELECT bl.id, bl.item_id, bl.quantity, bl.unit_price, bl.item_total, b.bill_date
      FROM bill_lines bl JOIN bills b ON b.id = bl.bill_id
      WHERE bl.item_id = ANY(${relatedIds})
      ORDER BY b.bill_date DESC LIMIT 30
    `
    let revisions = null
    try {
      revisions = await sql`SELECT * FROM stock_count_revisions WHERE item_id = 373 ORDER BY id DESC LIMIT 20`
    } catch (e) {
      revisions = `ERROR: ${e instanceof Error ? e.message : String(e)}`
    }
    return NextResponse.json({ item, viewDef, stockCountsCols, counts, summary, packRelations, aliases, packCounts, salesLines, billLines, revisions })
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: detail }, { status: 500 })
  }
}
