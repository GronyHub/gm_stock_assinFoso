import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const item = await sql`SELECT id, canonical_name, status, track_inventory, product_type FROM items WHERE id = 373`
  return NextResponse.json({ item })
}
