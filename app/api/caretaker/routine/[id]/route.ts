import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canManageRoutine, ensureCaretakerTables } from '@/lib/caretaker'
import { invalidateRoutineCache } from '@/lib/careRoutine'
import { CHILDREN } from '@/lib/caretakerShared'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Not allowed')
  await ensureCaretakerTables()
  const id = Number((await params).id)
  const b = await req.json().catch(() => null)
  const title = String(b?.title ?? '').trim().slice(0, 200)
  const time = String(b?.time ?? '')
  const scope = b?.scope === 'all' || (CHILDREN as readonly string[]).includes(b?.scope) ? b.scope : null
  if (!id || !title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !scope) return badRequest('Need a title, a time (HH:MM) and who it is for')
  await sql`UPDATE care_routine SET title = ${title}, time = ${time}, scope = ${scope}, important = ${!!b.important},
    day_type = ${b.day_type === 'weekend' ? 'weekend' : 'school'} WHERE id = ${id}`
  invalidateRoutineCache()
  return success({ ok: true })
}

// Soft delete: past completions keep pointing at a real row.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Not allowed')
  const id = Number((await params).id)
  if (!id) return badRequest('Bad id')
  await sql`UPDATE care_routine SET active = FALSE WHERE id = ${id}`
  invalidateRoutineCache()
  return success({ ok: true })
}
