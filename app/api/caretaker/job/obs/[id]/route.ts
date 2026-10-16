import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canSeeCH, canManageRoutine, caretakerName } from '@/lib/caretaker'

// Remove an observation: its author, or an owner / supervisor.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canSeeCH(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  const [row] = await sql`SELECT logged_by FROM care_job_obs WHERE id = ${id}`
  if (!row) return success({ ok: true })
  if (row.logged_by !== caretakerName(session) && !(await canManageRoutine(session))) return badRequest('Only the author or an owner can remove this')
  await sql`DELETE FROM care_job_obs WHERE id = ${id}`
  return success({ ok: true })
}
