import { requireAuth, badRequest, success, handleError, getActorName } from '@/lib/api'
import { getActivityDurationOverrides, setActivityDurationOverride, listKnownActivityActions } from '@/lib/activityDurations'
import { DEFAULT_ACTIVITY_DURATION_SECONDS } from '@/lib/workedDuration'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest } from 'next/server'

// Any authenticated user can read this -- the Home feed and the worked-time
// banner both need the current overrides to show the right duration for
// everyone, not just owner-level. Only owner-level can change a value
// (Settings > Activity Times), same gate Reorder Lists uses -- this changes
// shared app behavior, not a per-person setting.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const [overrides, actions] = await Promise.all([getActivityDurationOverrides(), listKnownActivityActions()])
    const list = actions.map(a => ({
      action: a.action,
      count: a.count,
      durationSeconds: overrides[a.action] ?? DEFAULT_ACTIVITY_DURATION_SECONDS,
      isDefault: overrides[a.action] == null,
    }))
    return success({ overrides, actions: list, defaultSeconds: DEFAULT_ACTIVITY_DURATION_SECONDS })
  } catch (e) {
    return handleError('activity-durations GET', e)
  }
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return badRequest('Forbidden')

  const { action, durationSeconds } = await req.json() as { action?: string; durationSeconds?: number | null }
  if (!action || typeof action !== 'string') return badRequest('action is required')
  if (durationSeconds !== null && durationSeconds !== undefined) {
    const n = Number(durationSeconds)
    if (!Number.isFinite(n) || n < 0) return badRequest('durationSeconds must be a non-negative number, or null to reset to the default')
  }

  try {
    await setActivityDurationOverride(action, durationSeconds == null ? null : Number(durationSeconds), getActorName(session))
    return success({ ok: true })
  } catch (e) {
    return handleError('activity-durations PUT', e)
  }
}
