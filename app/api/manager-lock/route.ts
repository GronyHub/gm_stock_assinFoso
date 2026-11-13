import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { lockStateForManager } from '@/lib/managerLock'
import { NextRequest } from 'next/server'

// GET -- the signed-in manager's lock state ({ locked: false } for everyone else; the owner also gets Joe's state, to excuse it).
// POST { excuse: 'YYYY-MM-DD' } -- the owner excuses Joe for that working day.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const fresh = req.nextUrl.searchParams.get('fresh') === '1'
    const me = actorKey(session.user as never), owner = (session.user as { role?: string })?.role === 'owner'
    if (owner) return success({ locked: false, day: null, cash: null, shortage: null, questions: null, approvals: 0, owner: true, joe: await lockStateForManager(undefined, fresh) })
    if (me !== 'joe') return success({ locked: false, day: null, cash: null, shortage: null, questions: null, approvals: 0 })
    return success(await lockStateForManager(undefined, fresh))
  } catch (e) { return handleError('manager lock', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role !== 'owner') return badRequest('Only the owner can excuse a day.')
  try {
    const b = await req.json().catch(() => ({})), day = String(b.excuse ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return badRequest('Choose a day.')
    await sql`INSERT INTO penalty_claims (key) VALUES (${'lock-excused:' + day}) ON CONFLICT DO NOTHING`
    void recordActivity(getActorName(session), 'excused the manager block', day)
    return success({ ok: true })
  } catch (e) { return handleError('manager lock excuse', e) }
}
