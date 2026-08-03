import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { ensurePageNotesTable } from '@/lib/pageNotes'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })
  const kind = req.nextUrl.searchParams.get('kind') === 'note' ? 'note' : 'law'

  await ensurePageNotesTable()
  const [row] = await sql`SELECT notes FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind}`
  return NextResponse.json({ notes: row?.notes ?? '' })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, kind, notes } = await req.json()
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })
  const k = kind === 'note' ? 'note' : 'law'

  await ensurePageNotesTable()
  await sql`
    INSERT INTO page_notes (scope_key, kind, notes, updated_at) VALUES (${scopeKey}, ${k}, ${notes ?? ''}, now())
    ON CONFLICT (scope_key, kind) DO UPDATE SET notes = ${notes ?? ''}, updated_at = now()
  `
  return NextResponse.json({ ok: true })
}
