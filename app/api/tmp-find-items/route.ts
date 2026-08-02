import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const pvc = await sql`
    SELECT id, canonical_name, cf_group, status FROM items
    WHERE canonical_name ILIKE '%PVC%' ORDER BY canonical_name
  `
  const invitation = await sql`
    SELECT id, canonical_name, cf_group, status, product_type FROM items
    WHERE canonical_name ILIKE '%invitation%' OR canonical_name ILIKE '%inv. cards%' OR canonical_name ILIKE '%inv cards%'
    ORDER BY canonical_name
  `
  const toner26a = await sql`
    SELECT id, canonical_name, cf_group, status FROM items
    WHERE canonical_name ILIKE '%26A%' ORDER BY canonical_name
  `
  return NextResponse.json({ pvc, invitation, toner26a })
}
