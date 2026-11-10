import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import { runChecks } from '@/lib/integrity'

// GET (Joe and Grony) -- the system check: where one part of the app does not agree with another.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe and Grony see the system check.')
  try { return success({ checks: await runChecks(), at: new Date().toISOString() }) } catch (e) { return handleError('integrity GET', e) }
}
