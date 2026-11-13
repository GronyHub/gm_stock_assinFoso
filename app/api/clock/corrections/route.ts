import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureAttendance, applyApproval, firstActivityMins, to12h } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// GET (the owner and Joe) -- clock-out times waiting for approval, with the staff member's clock-in and the time the app estimated.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as any)) return success({ pending: [], history: [] })
  try {
    await ensureAttendance()
    // ?history=1: every correction that was sent (newest first) with its outcome: who decided it and when. Shown under the Shop's Times grid.
    if (req.nextUrl.searchParams.get('history')) {
      const history = await sql`SELECT id, staff, work_date, field, proposed_out, status, requested_at, decided_by, decided_at, basis, note, against FROM clock_corrections ORDER BY requested_at DESC, id DESC LIMIT 100`
      return success({ history })
    }
    const me = actorKey(session.user as any)
    const pending = await sql`SELECT c.id, c.staff, c.work_date, c.field, c.proposed_out, c.requested_at, c.basis, t.actual_in, t.actual_out AS estimated
      FROM clock_corrections c LEFT JOIN staff_times t ON LOWER(t.staff_name) = c.staff AND t.work_date = c.work_date
      WHERE c.status = 'pending' AND c.staff <> ${me} AND COALESCE(c.against, '') <> ${me} ORDER BY c.requested_at`
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
    const id = Number(b.id), by = getActorName(session), me = actorKey(session.user as any)
    const [own] = await sql`SELECT staff, against FROM clock_corrections WHERE id = ${id}`
    if (own?.against && String(own.against) === me) return badRequest('You clocked this person out, so someone else decides their correction.')
    if (own && String(own.staff) === me) return badRequest('You cannot approve your own time. Grony approves Joe, and Joe approves the others.')
    if (b.action === 'approve') { const out = await applyApproval(id, by, b.time ? String(b.time) : undefined); return success({ ok: !!out, out }) }
    if (b.action === 'reject') {
      const [c] = await sql`SELECT staff, work_date, field FROM clock_corrections WHERE id = ${id} AND status = 'pending'`
      if (!c) return success({ ok: false })
      await sql`UPDATE clock_corrections SET status = 'rejected', decided_by = ${by}, decided_at = now() WHERE id = ${id}`
      if (c.field === 'in') {
        // A clock-in held for CCTV review (no GPS) that is not approved: the time becomes the person's first shop-only action that day, or is removed if there was none.
        const [t] = await sql`SELECT in_source FROM staff_times WHERE LOWER(staff_name) = ${String(c.staff)} AND work_date = ${String(c.work_date)}`
        if (t?.in_source === 'unverified') {
          const f = await firstActivityMins(String(c.staff), String(c.work_date))
          if (f != null) await sql`UPDATE staff_times SET actual_in = ${to12h(f)}, in_source = 'estimated' WHERE LOWER(staff_name) = ${String(c.staff)} AND work_date = ${String(c.work_date)}`
          else await sql`UPDATE staff_times SET actual_in = NULL, in_source = 'estimated' WHERE LOWER(staff_name) = ${String(c.staff)} AND work_date = ${String(c.work_date)}`
        }
        void pushToUsers([String(c.staff)], 'Clock-in time not approved', `${by} did not approve your time in for ${c.work_date} after checking the CCTV. Your time in is now your first action at the shop that day, or open Times and enter it again.`)
      } else void pushToUsers([String(c.staff)], 'Clock-out time not approved', `Your time for ${c.work_date} was not approved. The app's estimate stands.`)
      return success({ ok: true })
    }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('clock corrections PATCH', e) }
}
