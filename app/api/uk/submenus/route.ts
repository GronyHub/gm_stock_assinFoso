import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureUkTables } from '@/lib/ukTables'
import { NextRequest, NextResponse } from 'next/server'

// Private to the grony account -- same gate as /api/personal, checked on
// every route here since this is real user data, not just a hidden menu
// link.
function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json([], { status: 403 })
  await ensureUkTables()

  const person = req.nextUrl.searchParams.get('person')
  if (!person) return NextResponse.json({ error: 'Missing person' }, { status: 400 })

  const rows = await sql`
    SELECT id, person, name, sort_order, created_at
    FROM uk_submenus
    WHERE person = ${person}
    ORDER BY sort_order ASC, id ASC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await ensureUkTables()

  const { person, name } = await req.json()
  const text = typeof name === 'string' ? name.trim() : ''
  if (!person || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const [{ next_order }] = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM uk_submenus WHERE person = ${person}`
  const [row] = await sql`
    INSERT INTO uk_submenus (person, name, sort_order)
    VALUES (${person}, ${text}, ${next_order})
    RETURNING id, person, name, sort_order, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
