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
  const lawId = req.nextUrl.searchParams.get('lawId')

  await ensurePageNotesTable()
  if (lawId) {
    const [row] = await sql`SELECT notes, topic, note_date, tagged_staff FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind} AND law_id = ${parseInt(lawId)}`
    return NextResponse.json({
      notes: row?.notes ?? '',
      topic: row?.topic ?? '',
      noteDate: row?.note_date ?? '',
      taggedStaff: row?.tagged_staff ? JSON.parse(row.tagged_staff) : []
    })
  } else {
    const [row] = await sql`SELECT notes, topic, note_date, tagged_staff FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind} AND law_id IS NULL`
    return NextResponse.json({
      notes: row?.notes ?? '',
      topic: row?.topic ?? '',
      noteDate: row?.note_date ?? '',
      taggedStaff: row?.tagged_staff ? JSON.parse(row.tagged_staff) : []
    })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, kind, notes, law_id, flag_key, topic, noteDate, taggedStaff } = await req.json()
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })
  const k = kind === 'note' ? 'note' : 'law'

  await ensurePageNotesTable()
  if (law_id) {
    await sql`
      INSERT INTO page_notes (scope_key, kind, notes, law_id, topic, note_date, tagged_staff, updated_at)
      VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${law_id}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
      ON CONFLICT (scope_key, kind, law_id) DO UPDATE SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now()
    `
  } else if (flag_key) {
    await sql`
      INSERT INTO page_notes (scope_key, kind, notes, flag_key, topic, note_date, tagged_staff, updated_at)
      VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${flag_key}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
      ON CONFLICT (scope_key, kind, flag_key) DO UPDATE SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now()
    `
  } else {
    await sql`
      INSERT INTO page_notes (scope_key, kind, notes, topic, note_date, tagged_staff, updated_at)
      VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
      ON CONFLICT (scope_key, kind) DO UPDATE SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now() WHERE law_id IS NULL AND flag_key IS NULL
    `
  }
  return NextResponse.json({ ok: true })
}
