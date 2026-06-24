import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rows = await sql`
    SELECT id, staff_name, start_date::text, end_date::text, reason, absence_type
    FROM staff_absences ORDER BY start_date DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { staff_name, start_date, end_date, reason, absence_type } = await req.json()
  const enteredBy = session.user?.name || (session.user as any)?.username || null
  const row = await sql`
    INSERT INTO staff_absences (staff_name, start_date, end_date, reason, absence_type, entered_by)
    VALUES (${staff_name}, ${start_date}, ${end_date}, ${reason || null}, ${absence_type || 'other'}, ${enteredBy})
    RETURNING id, staff_name, start_date::text, end_date::text, reason, absence_type, entered_by
  `
  return NextResponse.json(row[0])
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  await sql`DELETE FROM staff_absences WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
