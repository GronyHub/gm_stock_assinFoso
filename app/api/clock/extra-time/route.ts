import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import { listExtra, decideExtra } from '@/lib/extraTime'
import { pushToUsers } from '@/lib/checklistAlerts'
import { recordActivity } from '@/lib/logger'

// GET -- extra time (before the rostered start / after the rostered end) waiting for approval; Joe and Grony see everyone's, each staff member only their own.
// POST { id, approve } -- Joe or Grony decides. Approved time is paid; anything else is not.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const all = isOwnerLevel(session.user as never), me = actorKey(session.user as never)
    const pendingOnly = req.nextUrl.searchParams.get('all') !== '1'
    return success({ rows: await listExtra({ pendingOnly, staff: all ? undefined : me }) })
  } catch (e) { return handleError('extra-time GET', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe or Grony can approve extra time.')
  try {
    const b = await req.json().catch(() => ({}))
    const id = Number(b.id)
    if (!id) return badRequest('Which one?')
    const by = actorKey(session.user as never)
    const r = await decideExtra(id, !!b.approve, by)
    if (!r) return badRequest('Not found')
    void recordActivity(by, b.approve ? 'approved extra time' : 'did not approve extra time', `${r.staff}: ${r.minutes} min on ${r.work_date}`)
    void pushToUsers([r.staff], b.approve ? 'Extra time approved' : 'Extra time not approved', `${r.minutes} minutes ${r.kind === 'early' ? 'before your start' : 'after your finish'} on ${r.work_date} ${b.approve ? 'will be paid' : 'will not be paid'}.`)
    return success({ ok: true })
  } catch (e) { return handleError('extra-time POST', e) }
}
