import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import { runChecks } from '@/lib/integrity'
import { GET as flagsGET } from '@/app/api/flags/route'

// GET (Joe and Grony) -- the system check: where one part of the app does not agree with another.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only Joe and Grony see the system check.')
  try {
    // The flags are computed by their own route; read them (cached for 30 minutes there) rather than computing them twice.
    const flags = await flagsGET().then(r => r.json()).catch(() => undefined)
    return success({ checks: await runChecks(flags && typeof flags === 'object' ? flags : undefined), at: new Date().toISOString() })
  } catch (e) { return handleError('integrity GET', e) }
}
