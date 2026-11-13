import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { othersStillIn, raiseChecks, openCheckFor, confirmCheck } from '@/lib/presenceCheck'
import { NextRequest } from 'next/server'

// GET -- my open "are you at the shop?" check (if someone said nobody is there); ?others=1 -- who else is still clocked in (asked of a person who has just clocked out after 18:00).
// POST { action: 'report_empty' } -- "nobody else is at the shop": each person still clocked in is asked to confirm. { action: 'confirm', id } -- "I am still at the shop".
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never)
    if (!SIGNERS.includes(me) || me === 'grony') return success({ check: null, others: [] })
    if (req.nextUrl.searchParams.get('others')) return success({ others: await othersStillIn(me) })
    return success({ check: await openCheckFor(me) })
  } catch (e) { return handleError('clock presence GET', e) }
}
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never)
    if (!SIGNERS.includes(me) || me === 'grony') return badRequest('Not on the shop staff list.')
    const b = await req.json().catch(() => ({}))
    if (b.action === 'report_empty') return success({ asked: await raiseChecks(me) })
    if (b.action === 'confirm') return success({ ok: await confirmCheck(me, Number(b.id)) })
    return badRequest('Unknown action.')
  } catch (e) { return handleError('clock presence POST', e) }
}
