import { requireAuth, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { getUserPermissionsMap, ensureUserPermissionsTable } from '@/lib/permissions'
import { NextRequest } from 'next/server'

// Any authenticated user can read the full matrix -- it's just feature
// flags, not sensitive, and every client needs it to render their own pane
// correctly. Only owner-level can change it.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error
  const map = await getUserPermissionsMap()
  return success(map)
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session!.user as any)) return badRequest('Forbidden')

  const { user_id, feature_key, allowed } = await req.json()
  if (!user_id || !feature_key || typeof allowed !== 'boolean') {
    return badRequest('user_id, feature_key, allowed required')
  }
  await ensureUserPermissionsTable()
  await sql`
    INSERT INTO user_permissions (user_id, feature_key, allowed)
    VALUES (${user_id}, ${feature_key}, ${allowed})
    ON CONFLICT (user_id, feature_key) DO UPDATE SET allowed = ${allowed}
  `
  return success({ ok: true })
}
