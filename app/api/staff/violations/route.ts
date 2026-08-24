import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

export async function GET() {
  const rows = await sql`
    SELECT id, staff_name, violation, details, severity, COALESCE(points, 0) AS points, recorded_by, created_at
    FROM staff_violations
    ORDER BY created_at DESC
  `
  return success(rows)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const role = (session!.user as any)?.role
  if (!['owner', 'manager'].includes(role)) return badRequest('Forbidden')

  const { staff_name, violation, details, severity, points } = await req.json()
  if (!staff_name || !violation) return badRequest('Missing fields')

  const actor = (session!.user as any)?.username || session!.user?.name || 'Unknown'
  try {
    const [row] = await sql`
      INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
      VALUES (${staff_name}, ${violation}, ${details ?? null}, ${severity ?? 'minor'}, ${points ?? 0}, ${actor})
      RETURNING *
    `
    await logActivity(actor, 'recorded violation', `${staff_name} — ${violation}`)
    return success(row)
  } catch (e) {
    return handleError('staff violations POST', e)
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Forbidden')

  const { id } = await req.json()
  try {
    await sql`DELETE FROM staff_violations WHERE id = ${id}`
    return success({ ok: true })
  } catch (e) {
    return handleError('staff violations DELETE', e)
  }
}
