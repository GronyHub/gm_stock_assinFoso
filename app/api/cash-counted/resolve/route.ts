import { NextRequest } from 'next/server'
import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import { isManagerName } from '@/lib/signers'
import { resolveCash } from '@/lib/cashCount'
import { recordActivity } from '@/lib/logger'
import { clearMyDayCache } from '@/lib/myDay'

// POST { day, value } -- the manager (or owner) says which Cash Counted is right for a day. The receipt and the closing answer both take it.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never)
    if (!isOwnerLevel(session.user as never) && !isManagerName(me)) return badRequest('Only the manager or the owner can choose.')
    const b = await req.json().catch(() => ({})), day = String(b.day ?? ''), v = Number(b.value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(v) || v < 0) return badRequest('Which day and figure?')
    if (!(await resolveCash(day, Math.round(v * 100) / 100))) return badRequest('There is no walk-in receipt for that day.')
    void recordActivity(getActorName(session), 'chose the Cash Counted', `${day}: ₵${v.toFixed(2)}`)
    clearMyDayCache()
    return success({ ok: true })
  } catch (e) { return handleError('cash-counted resolve', e) }
}
