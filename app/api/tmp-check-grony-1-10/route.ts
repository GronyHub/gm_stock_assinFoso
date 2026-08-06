import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, person, name, sort_order, created_at
    FROM uk_submenus
    WHERE person = 'Grony'
    ORDER BY sort_order, id
  `
  return NextResponse.json({ count: rows.length, rows })
}
