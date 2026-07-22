import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const viewDef = await sql`SELECT pg_get_viewdef('item_stock_summary'::regclass, true) AS def`

  return NextResponse.json({ viewDef })
}
