import { requireAuth, success, handleError } from '@/lib/api'
import { isManagerName } from '@/lib/signers'
import { actorKey } from '@/lib/clockState'
import { progress } from '@/lib/flagQuota'

// GET -- today's flags count for the daily law (managers only): fixed since the morning, how many are needed, negative stock still open.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isManagerName(actorKey(session.user as never))) return success({ progress: null })
  try { return success({ progress: await progress(new Date().toISOString().slice(0, 10)) }) } catch (e) { return handleError('flags quota', e) }
}
