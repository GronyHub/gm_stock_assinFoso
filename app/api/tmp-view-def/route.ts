import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const def = await sql`SELECT pg_get_viewdef('item_stock_summary'::regclass, true) AS def`
    const cols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'item_stock_summary' ORDER BY ordinal_position
    `
    return NextResponse.json({ def: def[0]?.def, cols })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
