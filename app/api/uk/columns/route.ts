import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensureUkTables } from '@/lib/ukTables'
import { NextRequest, NextResponse } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json([], { status: 403 })
  await ensureUkTables()

  const submenuId = req.nextUrl.searchParams.get('submenu_id')
  if (!submenuId) return NextResponse.json({ error: 'Missing submenu_id' }, { status: 400 })

  const rows = await sql`
    SELECT id, submenu_id, name, sort_order, created_at
    FROM uk_columns
    WHERE submenu_id = ${Number(submenuId)}
    ORDER BY sort_order ASC, id ASC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  await ensureUkTables()

  const { submenu_id, name } = await req.json()
  const text = typeof name === 'string' ? name.trim() : ''
  if (!submenu_id || !text) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const [{ next_order }] = await sql`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM uk_columns WHERE submenu_id = ${submenu_id}`
  const [row] = await sql`
    INSERT INTO uk_columns (submenu_id, name, sort_order)
    VALUES (${submenu_id}, ${text}, ${next_order})
    RETURNING id, submenu_id, name, sort_order, created_at
  `
  return NextResponse.json(row, { status: 201 })
}
