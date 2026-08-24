import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'

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
    const rows = await sql`SELECT LOWER(username) AS username, active FROM app_users`
    return success(rows)
  } catch (e) {
    return handleError('staff/status GET', e)
  }
}
