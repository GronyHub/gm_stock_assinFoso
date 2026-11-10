import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { ensureAttendance } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// GET -- questions waiting for my answer. POST { id, answer } -- answer one; Joe is told.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureAttendance()
    const me = actorKey(user as never)
    const rows = await sql`SELECT id, from_user, about, work_date, asked_at FROM staff_queries WHERE staff = ${me} AND status = 'open' ORDER BY asked_at`
    return success({ queries: rows })
  } catch (e) { return handleError('staff-queries GET', e) }
}
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureAttendance()
    const me = actorKey(user as never)
    const b = await req.json().catch(() => ({})), answer = String(b.answer ?? '').trim().slice(0, 600)
    if (answer.length < 3) return badRequest('Write your answer.')
    const [q] = await sql`UPDATE staff_queries SET status = 'answered', answer = ${answer}, answered_at = now() WHERE id = ${Number(b.id)} AND staff = ${me} AND status = 'open' RETURNING from_user, work_date`
    if (!q) return badRequest('That question is already answered.')
    void pushToUsers([String(q.from_user).toLowerCase(), 'joe'], `${me.charAt(0).toUpperCase() + me.slice(1)} answered your question`, `About ${q.work_date}: ${answer.slice(0, 120)}`)
    return success({ ok: true })
  } catch (e) { return handleError('staff-queries POST', e) }
}
