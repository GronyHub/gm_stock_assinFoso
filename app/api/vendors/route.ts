import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const rows = await sql`SELECT id, display_name AS name FROM vendors ORDER BY display_name LIMIT 200`
  return NextResponse.json(rows)
}
