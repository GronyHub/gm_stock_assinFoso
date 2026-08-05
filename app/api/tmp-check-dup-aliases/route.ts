import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const names = ['A3 BROWN ENVELOPE SINGLES', 'A4 210 grams', 'A4 SHEETS DOUBLE A', 'Advance Ink 100ml - Light  Magenta']
  const rows = await sql`
    SELECT a.id AS alias_id, a.alias_name, a.item_id, i.canonical_name, a.alias_type, a.source
    FROM item_aliases a
    JOIN items i ON i.id = a.item_id
    WHERE LOWER(TRIM(a.alias_name)) = ANY(${names.map(n => n.toLowerCase().trim())})
    ORDER BY a.alias_name, a.id
  `
  const dismissed = await sql`SELECT review_key FROM dismissed_alias_reviews WHERE review_type = 'name_conflict'`
  return NextResponse.json({ rows, dismissed })
}
