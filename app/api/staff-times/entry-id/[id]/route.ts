import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const u = session.user as any
  const username = (u?.username ?? u?.name ?? '').toLowerCase()
  if (u?.role !== 'owner' && u?.role !== 'admin' && username !== 'rawlings' && username !== 'grony') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { actual_in, actual_out } = await req.json()
  const actor = u?.username ?? u?.name ?? 'Unknown'

  const [row] = await sql`
    UPDATE staff_times
    SET actual_in = ${actual_in ?? null}, actual_out = ${actual_out ?? null}, entered_by = ${actor}
    WHERE id = ${Number(id)}
    RETURNING id, staff_name, work_date::text, actual_in, actual_out, entered_by
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logActivity(actor, 'edited time entry', `${row.staff_name} on ${row.work_date} · in ${actual_in ?? '—'} out ${actual_out ?? '—'}`)
  return NextResponse.json(row)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const u = session.user as any
  const username = (u?.username ?? u?.name ?? '').toLowerCase()
  if (u?.role !== 'owner' && u?.role !== 'admin' && username !== 'rawlings' && username !== 'grony') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const actor = u?.username ?? u?.name ?? 'Unknown'

  const [row] = await sql`
    DELETE FROM staff_times WHERE id = ${Number(id)}
    RETURNING id, staff_name, work_date::text
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await logActivity(actor, 'deleted time entry', `${row.staff_name} on ${row.work_date}`)
  return NextResponse.json({ ok: true })
}
