import sql from '@/lib/db'
import { NextResponse } from 'next/server'

const NAMES = ['a3 210 grams', 'a4 lamination', 'blue cardboard', 'green cardboard', 'pink cardboard', 'yellow cardboard']

export async function GET() {
  const rows = await sql`
    SELECT a.id AS alias_id, a.alias_name, a.item_id, i.canonical_name
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(a.alias_name)) = ANY(${NAMES})
    ORDER BY a.alias_name, a.id
  `
  return NextResponse.json(rows)
}
