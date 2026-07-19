import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT DISTINCT status, COUNT(*)::int AS cnt
    FROM items
    GROUP BY status
    ORDER BY cnt DESC
  `
  return NextResponse.json(rows)
}
