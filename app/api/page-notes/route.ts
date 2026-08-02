import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensurePageNotesTable } from '@/lib/pageNotes'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })

  await ensurePageNotesTable()
  const [row] = await sql`SELECT notes FROM page_notes WHERE scope_key = ${scopeKey}`
  return NextResponse.json({ notes: row?.notes ?? '' })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, notes } = await req.json()
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })

  await ensurePageNotesTable()
  await sql`
    INSERT INTO page_notes (scope_key, notes, updated_at) VALUES (${scopeKey}, ${notes ?? ''}, now())
    ON CONFLICT (scope_key) DO UPDATE SET notes = ${notes ?? ''}, updated_at = now()
  `
  return NextResponse.json({ ok: true })
}
