import { requireAuth, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { weekProgress } from '@/lib/countQuota'
import { dayKey } from '@/lib/dailyChecksShared'

// GET -- how many different items the signed-in person has counted this week, against the weekly counts law.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const me = actorKey(session.user as never).toLowerCase()
    return success(await weekProgress(me, dayKey()))
  } catch (e) { return handleError('stock week', e) }
}
