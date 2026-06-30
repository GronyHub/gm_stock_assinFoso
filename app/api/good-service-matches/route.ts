import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    const rows = await sql`
      SELECT id, good_name, service_name FROM good_service_matches ORDER BY good_name, service_name
    `
    return NextResponse.json(rows)
  } catch (e) {
    console.error('good-service-matches GET error:', e)
    return NextResponse.json([])
  }
}

// POST { good_name, service_name } -- add a single pair
export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { good_name, service_name } = await req.json()
  if (!good_name || !service_name) return NextResponse.json({ error: 'good_name and service_name required' }, { status: 400 })

  try {
    const [row] = await sql`
      INSERT INTO good_service_matches (good_name, service_name)
      VALUES (${good_name}, ${service_name})
      ON CONFLICT (good_name, service_name) DO NOTHING
      RETURNING id, good_name, service_name
    `
    return NextResponse.json(row ?? { ok: true })
  } catch (e) {
    console.error('good-service-matches POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not add match: ${detail}` }, { status: 500 })
  }
}
