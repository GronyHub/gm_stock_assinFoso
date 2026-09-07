import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { getCached } from '@/lib/cacheStore'

const ensureActiveColumn = once(async () => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})
})

// Just the active/inactive flag per username -- deliberately not gated to
// owner-level like /api/users (which also returns email, role, resignation
// reason, etc.). Any logged-in staff member's Times tab needs this to know
// which columns of the shared history grid to hide, same as it already sees
// everyone else's clock times there.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  await ensureActiveColumn()

  try {
    // Every open Item hub tab polls this every 10 minutes regardless of
    // which sub-tab is showing, and active/inactive rarely changes (an
    // owner toggling one staff member's account) -- a short cache absorbs
    // that background traffic without any user-visible staleness that
    // matters (deactivation itself is already re-checked on every protected
    // page load in the layout, independent of this endpoint).
    const rows = await getCached('staff:status', 300, () => sql`SELECT LOWER(username) AS username, active FROM app_users`)
    return success(rows)
  } catch (e) {
    return handleError('staff/status GET', e)
  }
}
