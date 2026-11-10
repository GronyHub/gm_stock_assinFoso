import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureAttendance, applyApproval } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// GET (the owner and Joe) -- clock-out times waiting for approval, with the staff member's clock-in and the time the app estimated.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return success({ pending: [] })
  try {
    await ensureAttendance()
    const pending = await sql`SELECT c.id, c.staff, c.work_date, c.proposed_out, c.requested_at, t.actual_in, t.actual_out AS estimated
      FROM clock_corrections c LEFT JOIN staff_times t ON LOWER(t.staff_name) = c.staff AND t.work_date = c.work_date
      WHERE c.status = 'pending' ORDER BY c.requested_at`
    return success({ pending })
  } catch (e) { return handleError('clock corrections GET', e) }
}

// PATCH { id, action: 'approve' | 'reject', time? } -- only the owner and Joe decide. Approving can change the time.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and Joe can approve clock-out times.')
  try {
    await ensureAttendance()
    const b = await req.json().catch(() => ({}))
    const id = Number(b.id), by = getActorName(session)
    if (b.action === 'approve') { const out = await applyApproval(id, by, b.time ? String(b.time) : undefined); return success({ ok: !!out, out }) }
    if (b.action === 'reject') {
      const [c] = await sql`SELECT staff, work_date FROM clock_corrections WHERE id = ${id} AND status = 'pending'`
      if (!c) return success({ ok: false })
      await sql`UPDATE clock_corrections SET status = 'rejected', decided_by = ${by}, decided_at = now() WHERE id = ${id}`
      void pushToUsers([String(c.staff)], 'Clock-out time not approved', `Your time for ${c.work_date} was not approved. The app's estimate stands.`)
      return success({ ok: true })
    }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('clock corrections PATCH', e) }
}
