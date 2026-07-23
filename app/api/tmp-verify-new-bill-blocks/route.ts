import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, canonical_name, product_type, status FROM items
    WHERE canonical_name ILIKE '%210%' OR canonical_name ILIKE '%260%double%' OR canonical_name ILIKE '%260g%double%'
    ORDER BY canonical_name
  `
  return NextResponse.json(rows)
}
