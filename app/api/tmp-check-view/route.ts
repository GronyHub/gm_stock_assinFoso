import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const [def] = await sql`SELECT pg_get_viewdef('item_stock_summary'::regclass, true) AS def`.catch(() => [{ def: null }])
  const items = await sql`
    SELECT id, canonical_name, opening_stock, opening_stock_value, stock_on_hand, status
    FROM items WHERE id IN (81, 82, 276, 371, 278)
  `
  return NextResponse.json({ viewDef: def?.def, items })
}
