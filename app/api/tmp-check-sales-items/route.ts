import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, canonical_name, product_type, status
    FROM items
    WHERE canonical_name ILIKE '%exv%' OR canonical_name ILIKE '%framing%'
       OR canonical_name ILIKE '%hdtv%' OR canonical_name ILIKE '%v3%'
    ORDER BY canonical_name
  `
  return NextResponse.json({ count: rows.length, rows })
}
