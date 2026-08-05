import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT scope_key, id, text, created_at
    FROM page_laws
    ORDER BY scope_key, id
  `
  return NextResponse.json({ count: rows.length, rows })
}
