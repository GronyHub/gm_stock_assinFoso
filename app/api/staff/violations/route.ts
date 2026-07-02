import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, staff_name, violation, details, severity, COALESCE(points, 0) AS points, recorded_by, created_at
    FROM staff_violations
    ORDER BY created_at DESC
  `
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (!['owner', 'manager'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { staff_name, violation, details, severity, points } = await req.json()
  if (!staff_name || !violation) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  const [row] = await sql`
    INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
    VALUES (${staff_name}, ${violation}, ${details ?? null}, ${severity ?? 'minor'}, ${points ?? 0}, ${actor})
    RETURNING *
  `
  await logActivity(actor, 'recorded violation', `${staff_name} — ${violation}`)
  return NextResponse.json(row)
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json()
  await sql`DELETE FROM staff_violations WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
