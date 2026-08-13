import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { initializeDatabase } from '@/lib/dbInitialize'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json(null, { status: 401 })

  const scopeKey = req.nextUrl.searchParams.get('scopeKey')
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })
  const kind = req.nextUrl.searchParams.get('kind') === 'note' ? 'note' : 'law'
  const lawId = req.nextUrl.searchParams.get('lawId')
  const flagKey = req.nextUrl.searchParams.get('flagKey')

  try {
    await initializeDatabase()
    if (lawId) {
      const lawIdNum = parseInt(lawId, 10)
      if (isNaN(lawIdNum)) return NextResponse.json({ notes: '', topic: '', noteDate: '', taggedStaff: [] })
      const [row] = await sql`SELECT notes, topic, note_date, tagged_staff FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind} AND law_id = ${lawIdNum}`
      return NextResponse.json({
        notes: row?.notes ?? '',
        topic: row?.topic ?? '',
        noteDate: row?.note_date ?? '',
        taggedStaff: row?.tagged_staff ? JSON.parse(row.tagged_staff) : []
      })
    } else if (flagKey) {
      const [row] = await sql`SELECT notes, topic, note_date, tagged_staff FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind} AND flag_key = ${flagKey}`
      return NextResponse.json({
        notes: row?.notes ?? '',
        topic: row?.topic ?? '',
        noteDate: row?.note_date ?? '',
        taggedStaff: row?.tagged_staff ? JSON.parse(row.tagged_staff) : []
      })
    } else {
      const [row] = await sql`SELECT notes, topic, note_date, tagged_staff FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${kind} AND law_id IS NULL AND flag_key IS NULL`
      return NextResponse.json({
        notes: row?.notes ?? '',
        topic: row?.topic ?? '',
        noteDate: row?.note_date ?? '',
        taggedStaff: row?.tagged_staff ? JSON.parse(row.tagged_staff) : []
      })
    }
  } catch (e) {
    console.error('page-notes GET error:', e)
    return NextResponse.json({
      notes: '', topic: '', noteDate: '', taggedStaff: []
    })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { scopeKey, kind, notes, law_id, flag_key, topic, noteDate, taggedStaff } = await req.json()
  if (!scopeKey) return NextResponse.json({ error: 'Missing scopeKey' }, { status: 400 })
  const k = kind === 'note' ? 'note' : 'law'

  try {
    await initializeDatabase()
    if (law_id) {
      const [existing] = await sql`SELECT 1 FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${k} AND law_id = ${law_id}`
      if (existing) {
        await sql`
          UPDATE page_notes
          SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now()
          WHERE scope_key = ${scopeKey} AND kind = ${k} AND law_id = ${law_id}
        `
      } else {
        await sql`
          INSERT INTO page_notes (scope_key, kind, notes, law_id, topic, note_date, tagged_staff, updated_at)
          VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${law_id}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
        `
      }
    } else if (flag_key) {
      const [existing] = await sql`SELECT 1 FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${k} AND flag_key = ${flag_key}`
      if (existing) {
        await sql`
          UPDATE page_notes
          SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now()
          WHERE scope_key = ${scopeKey} AND kind = ${k} AND flag_key = ${flag_key}
        `
      } else {
        await sql`
          INSERT INTO page_notes (scope_key, kind, notes, flag_key, topic, note_date, tagged_staff, updated_at)
          VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${flag_key}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
        `
      }
    } else {
      const [existing] = await sql`SELECT 1 FROM page_notes WHERE scope_key = ${scopeKey} AND kind = ${k} AND law_id IS NULL AND flag_key IS NULL`
      if (existing) {
        await sql`
          UPDATE page_notes
          SET notes = ${notes ?? ''}, topic = ${topic ?? ''}, note_date = ${noteDate ?? null}, tagged_staff = ${JSON.stringify(taggedStaff ?? [])}, updated_at = now()
          WHERE scope_key = ${scopeKey} AND kind = ${k} AND law_id IS NULL AND flag_key IS NULL
        `
      } else {
        await sql`
          INSERT INTO page_notes (scope_key, kind, notes, topic, note_date, tagged_staff, updated_at)
          VALUES (${scopeKey}, ${k}, ${notes ?? ''}, ${topic ?? ''}, ${noteDate ?? null}, ${JSON.stringify(taggedStaff ?? [])}, now())
        `
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('page-notes PUT error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save note: ${detail}` }, { status: 500 })
  }
}
