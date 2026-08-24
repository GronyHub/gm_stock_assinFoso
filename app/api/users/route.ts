import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import bcrypt from 'bcryptjs'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

// The staff-lifecycle columns. The DROP CONSTRAINT calls further down stay
// inline deliberately -- they're part of the role-change write path, not
// schema setup, and those routes aren't polled.
const ensureUserLifecycleCols = once(async () => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS resigned_at DATE`.catch(() => {})
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT`.catch(() => {})
})

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest('Forbidden')
  await ensureUserLifecycleCols()
  const rows = await sql`
    SELECT id, username, display_name, email, role, created_at, active, resigned_at::text, deactivation_reason
    FROM app_users ORDER BY id
  `
  return success(rows)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) return badRequest('Forbidden')

  try {
    const { username, display_name, email, role, password } = await req.json()
    if (!username || !password || !role) return badRequest('Missing fields')

    const [existing] = await sql`SELECT id FROM app_users WHERE username = ${username}`
    if (existing) return badRequest(`Username "${username}" is already taken`)

    const [roleRow] = await sql`SELECT key FROM roles WHERE key = ${role}`
    if (!roleRow) return badRequest(`Role "${role}" does not exist`)

    // Leftover from before custom roles existed -- app_users.role was
    // originally CHECK-constrained to the three built-in values, so any
    // custom role created from the Roles screen fails at the DB level the
    // moment someone's assigned it. Role validity is enforced above via the
    // roles table instead, which stays in sync as roles are added/removed.
    await sql`ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check`.catch(() => {})

    const hash = await bcrypt.hash(password, 12)
    const [row] = await sql`
      INSERT INTO app_users (username, display_name, email, role, password_hash)
      VALUES (${username}, ${display_name ?? username}, ${email ?? null}, ${role}, ${hash})
      RETURNING id, username, display_name, email, role, created_at
    `
    return success(row)
  } catch (e) {
    return handleError('users POST', e)
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const sessionUser = session?.user as any
  if (!isOwnerLevel(sessionUser)) return badRequest('Forbidden')
  const { id, role } = await req.json()
  if (!id || !role) return badRequest('Missing fields')

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${id}`
  if (!target) return notFound()
  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  if (targetIsProtected && sessionUser?.role !== 'owner') {
    return badRequest('Forbidden')
  }

  const [roleRow] = await sql`SELECT key FROM roles WHERE key = ${role}`
  if (!roleRow) return badRequest(`Role "${role}" does not exist`)
  await sql`ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check`.catch(() => {})

  const [row] = await sql`
    UPDATE app_users SET role = ${role} WHERE id = ${id}
    RETURNING id, username, display_name, role
  `
  return success(row)
}
