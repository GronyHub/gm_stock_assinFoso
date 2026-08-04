import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`SELECT id, person, name FROM uk_submenus WHERE person = 'Grony' ORDER BY name`
  return NextResponse.json(rows)
}
