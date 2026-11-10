import { actorKey } from '@/lib/clockState'
import { getAuthUser, success, handleError } from '@/lib/api'
import { fixedTargets } from '@/lib/violationLog'
import { SIGNERS, OWNER_SIGNERS } from '@/lib/signers'

// GET -- the people the signed-in person may log a violation against (empty: no log button for them).
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    const fixed = fixedTargets(user as never)
    if (fixed) return success({ targets: fixed })
    return success({ targets: SIGNERS.filter(n => !OWNER_SIGNERS.includes(n) && n !== actorKey(user as never)) })
  } catch (e) { return handleError('penalties log-targets', e) }
}
