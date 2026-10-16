import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { success, badRequest, unauthorized } from '@/lib/api'
import { canCaretake, canManageRoutine, caretakerName, ensureCaretakerTables } from '@/lib/caretaker'
import { loadRoutine, invalidateRoutineCache } from '@/lib/careRoutine'
import { CHILDREN } from '@/lib/caretakerShared'

// GET -> the whole routine (both day types); the screen picks today's.
export async function GET() {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canCaretake(session))) return success([], 403)
  try {
    return success(await loadRoutine())
  } catch (e) {
    console.error('routine GET error:', e instanceof Error ? e.message : String(e))
    return success([], 500)
  }
}

// POST { day_type, time, title, scope, important } -- owners / supervisors only.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return unauthorized()
  if (!(await canManageRoutine(session))) return badRequest('Only the people supervising the caretaker can change the routine')
  await ensureCaretakerTables()
  const b = await req.json().catch(() => null)
  const title = String(b?.title ?? '').trim().slice(0, 200)
  const time = String(b?.time ?? '')
  const dayTypeV = b?.day_type === 'weekend' ? 'weekend' : 'school'
  const scope = b?.scope === 'all' || (CHILDREN as readonly string[]).includes(b?.scope) ? b.scope : null
  if (!title || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !scope) return badRequest('Need a title, a time (HH:MM) and who it is for')
  const [row] = await sql`
    INSERT INTO care_routine (day_type, time, title, scope, important, created_by)
    VALUES (${dayTypeV}, ${time}, ${title}, ${scope}, ${!!b.important}, ${caretakerName(session)})
    RETURNING id, day_type, time, title, scope, important, active`
  invalidateRoutineCache()
  return success(row, 201)
}
