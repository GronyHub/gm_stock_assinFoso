import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT a.id AS alias_id, a.alias_name, a.item_id, i.canonical_name, a.alias_type, a.source
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(a.alias_name)) = 'a4 lamination'
    ORDER BY a.id
  `
  return NextResponse.json(rows)
}
