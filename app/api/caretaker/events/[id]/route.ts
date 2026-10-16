import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, caretakerName, isOwnerSession } from '@/lib/caretaker'

// Undo a mistaken tap: the person who made a record can remove it for 2
// minutes; owners can remove any record. After that records are permanent.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  if (!id) return badRequest('Bad id')
  const [row] = await sql`SELECT recorded_by, recorded_at FROM care_events WHERE id = ${id}`
  if (!row) return success({ ok: true })
  const mine = row.recorded_by === caretakerName(session)
  const recent = Date.now() - new Date(row.recorded_at as string).getTime() < 2 * 60 * 1000
  if (!isOwnerSession(session) && !(mine && recent)) return badRequest('Too late to undo. Records are permanent after 2 minutes.')
  await sql`DELETE FROM care_events WHERE id = ${id}`
  return success({ ok: true })
}
