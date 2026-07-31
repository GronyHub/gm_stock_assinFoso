import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const item = await sql`SELECT id, canonical_name, status, track_inventory, product_type FROM items WHERE id = 373`
  const nullStatusCount = await sql`SELECT COUNT(*) FROM items WHERE status IS NULL`
  const nullStatusSample = await sql`SELECT id, canonical_name, product_type FROM items WHERE status IS NULL ORDER BY id LIMIT 30`
  const totalItems = await sql`SELECT COUNT(*) FROM items`
  return NextResponse.json({ item, nullStatusCount: nullStatusCount[0], nullStatusSample, totalItems: totalItems[0] })
}
