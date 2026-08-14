import { NextRequest, NextResponse } from 'next/server'
import sql from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
  }

  try {
    const rows = await sql`
      SELECT id, name FROM active_items
      WHERE LOWER(category) = LOWER(${type})
      ORDER BY name ASC
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('Error fetching items by type:', e)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}
