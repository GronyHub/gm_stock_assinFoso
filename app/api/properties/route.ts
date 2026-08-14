import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    const properties = await sql`
      SELECT DISTINCT i.id, i.name
      FROM items i
      WHERE (i.status IS NULL OR LOWER(i.status) != 'inactive')
      ORDER BY i.name ASC
    `
    return NextResponse.json(properties)
  } catch (e) {
    console.error('Failed to fetch properties:', e)
    return NextResponse.json([], { status: 500 })
  }
}
