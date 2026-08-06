import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT id, item_name, status, cf_group FROM items
      WHERE item_name ILIKE '%A4%' AND item_name ILIKE '%single%'
      ORDER BY id
    `
    return NextResponse.json({ tmpFindA4Single: rows })
  } catch (e) {
    return NextResponse.json({ tmpError: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
