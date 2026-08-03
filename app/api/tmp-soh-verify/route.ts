import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const count = await sql`SELECT COUNT(*)::int AS n FROM item_stock_summary`
    // A plain item with no converts_to_item_id relationship anywhere --
    // its calculated_soh should be byte-identical to before this change.
    const control = await sql`
      SELECT s.item_id, s.item_name, s.calculated_soh, s.conversions_since_count
      FROM item_stock_summary s
      WHERE s.item_id = 100
    `
    const nullCheck = await sql`
      SELECT COUNT(*)::int AS n FROM item_stock_summary WHERE conversions_since_count IS NULL OR total_converted_in IS NULL
    `
    return NextResponse.json({ count, control, nullCheck })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
