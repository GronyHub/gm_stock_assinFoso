import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import { confirmPending, reversePoint, ensurePenalties, afterChange, isCounting, totalPoints } from '@/lib/penalties'
import { actorKey } from '@/lib/clockState'
import { notifyOwners, pushToUsers } from '@/lib/checklistAlerts'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// PATCH { action } -- staff: 'acknowledge' | 'dispute' (with a note) their own logged violation. Owner and manager: 'confirm' | 'dismiss' a pending
// one, 'reverse' a point, 'uphold' a disputed one (it counts again), or 'withdraw' it ({ reason }: the points are taken back, the reason kept).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensurePenalties()
    const id = Number((await params).id), who = getActorName(session)
    const b = await req.json().catch(() => ({}))
    const action = String(b.action ?? '')
    if (action === 'acknowledge' || action === 'dispute') {
      const me = actorKey(session.user as any)
      const [p] = await sql`SELECT id, staff, status, reason, points FROM staff_penalties WHERE id = ${id}`
      if (!p || String(p.staff) !== me) return badRequest('That is not your entry.')
      if (!['active', 'pending'].includes(String(p.status))) return badRequest('This entry can no longer be changed.')
      if (action === 'acknowledge') { await sql`UPDATE staff_penalties SET ack_at = now() WHERE id = ${id}`; return success({ ok: true }) }
      const note = String(b.note ?? '').trim().slice(0, 300)
      if (note.length < 4) return badRequest('Write why you dispute it.')
      await sql`UPDATE staff_penalties SET status = 'disputed', dispute_note = ${note} WHERE id = ${id}`
      void notifyOwners(`Violation disputed by ${me}`, `${String(p.reason).slice(0, 120)}. Their note: ${note}`)
      return success({ ok: true })
    }
    if (!isOwnerLevel(session.user as any)) return badRequest('Only the owner and manager can do this.')
    if (action === 'confirm') return success({ ok: await confirmPending(id, who) })
    if (action === 'dismiss') { await sql`UPDATE staff_penalties SET status = 'dismissed', note = ${'Dismissed by ' + who} WHERE id = ${id} AND status = 'pending'`; return success({ ok: true }) }
    if (action === 'reverse') return success({ ok: await reversePoint(id, who) })
    if (action === 'uphold') {
      const [p] = await sql`SELECT id, staff, points, day, status FROM staff_penalties WHERE id = ${id}`
      if (!p || p.status !== 'disputed') return badRequest('That entry is not disputed.')
      const counted = await isCounting(String(p.day)), before = await totalPoints(String(p.staff))
      await sql`UPDATE staff_penalties SET status = 'active', counted = ${counted}, note = ${'Upheld by ' + who} WHERE id = ${id}`
      if (counted) await afterChange(String(p.staff), before, before + Number(p.points))
      void pushToUsers([String(p.staff)], 'Your dispute was reviewed', 'The violation was upheld.')
      return success({ ok: true })
    }
    if (action === 'withdraw') {
      const reason = String(b.reason ?? '').trim().slice(0, 300)
      if (reason.length < 4) return badRequest('Write the reason for withdrawing it.')
      const [p] = await sql`SELECT id, staff FROM staff_penalties WHERE id = ${id}`
      if (!p) return badRequest('Not found.')
      await sql`UPDATE staff_penalties SET status = 'withdrawn', withdraw_reason = ${reason}, note = ${'Withdrawn by ' + who} WHERE id = ${id} AND status IN ('active', 'pending', 'disputed')`
      void pushToUsers([String(p.staff)], 'A violation was withdrawn', reason)
      return success({ ok: true })
    }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('penalties PATCH', e) }
}
