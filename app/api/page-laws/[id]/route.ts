import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { text } = await req.json()
  const trimmed = typeof text === 'string' ? text.trim() : ''
  if (!trimmed) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const [row] = await sql`UPDATE page_laws SET text = ${trimmed} WHERE id = ${Number(id)} RETURNING id, text, created_at`
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await sql`DELETE FROM page_laws WHERE id = ${Number(id)}`
  return NextResponse.json({ ok: true })
}
