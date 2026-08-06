import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

function isAllowed(session: any) {
  const username = ((session?.user as any)?.username as string | undefined)?.toLowerCase()
  return username === 'grony'
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { name, is_wide } = await req.json()
  const text = typeof name === 'string' ? name.trim() : ''
  if (!text) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const [row] = await sql`
    UPDATE uk_columns SET name = ${text}, is_wide = COALESCE(${is_wide ?? null}, is_wide) WHERE id = ${Number(id)}
    RETURNING id, submenu_id, name, sort_order, created_at, is_wide
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session || !isAllowed(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  await sql`DELETE FROM uk_columns WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
