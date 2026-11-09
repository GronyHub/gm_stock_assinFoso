import { getAuthUser, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { fixedTargets } from '@/lib/violationLog'

// GET -- the people the signed-in person may log a violation against (empty: no log button for them).
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    const fixed = fixedTargets(user as never)
    if (fixed) return success({ targets: fixed })
    const rows = await sql`SELECT LOWER(username) AS u FROM app_users WHERE active IS NOT FALSE AND role NOT IN ('owner', 'children_manager') AND LOWER(username) <> 'joe' ORDER BY username`
    return success({ targets: rows.map(r => String(r.u)) })
  } catch (e) { return handleError('penalties log-targets', e) }
}
