import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import { setLawGroup } from '@/lib/questionGroups'
import { NextRequest } from 'next/server'

// POST { law_id, group_id } -- put a law into a question group from its own page; group_id null takes it out.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and the manager build question groups.')
  try {
    const b = await req.json().catch(() => ({}))
    const lawId = Number(b.law_id), groupId = b.group_id == null || b.group_id === '' ? null : Number(b.group_id)
    if (!lawId) return badRequest('Choose a law.')
    try { await setLawGroup(lawId, groupId) } catch (e) { return badRequest(e instanceof Error ? e.message : 'Could not change the group.') }
    return success({ ok: true })
  } catch (e) { return handleError('question groups law', e) }
}
