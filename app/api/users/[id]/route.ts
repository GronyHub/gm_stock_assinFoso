import { requireAuth, badRequest, notFound, success } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

const ensureSchema = once(async () => {
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS resigned_at DATE`.catch(() => {})
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS deactivation_reason TEXT`.catch(() => {})
})


type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  const sessionUser = session?.user as any
  const { id } = await params
  const userId = Number(id)
  const isSelf = String(sessionUser?.id) === id

  // Owner and Joe can edit anyone; everyone else can only edit themselves
  if (!isOwnerLevel(sessionUser) && !isSelf) {
    return badRequest('Forbidden')
  }

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${userId}`
  if (!target) return notFound()

  // The owner account itself can only be edited by the real owner, not by Joe's owner-level access
  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  const canEditTarget = isSelf || sessionUser?.role === 'owner' || (isOwnerLevel(sessionUser) && !targetIsProtected)
  if (!canEditTarget) return badRequest('Forbidden')

  const { display_name, email, role, password } = await req.json()

  if (display_name !== undefined) {
    const [row] = await sql`UPDATE app_users SET display_name = ${display_name} WHERE id = ${userId} RETURNING id`
    if (!row) return notFound()
  }
  if (email !== undefined) {
    await sql`UPDATE app_users SET email = ${email || null} WHERE id = ${userId}`
  }
  if (role !== undefined && isOwnerLevel(sessionUser) && !targetIsProtected) {
    await sql`UPDATE app_users SET role = ${role} WHERE id = ${userId}`
  }
  if (password) {
    const hash = await bcrypt.hash(password, 12)
    await sql`UPDATE app_users SET password_hash = ${hash} WHERE id = ${userId}`
  }

  const [updated] = await sql`
    SELECT id, username, display_name, email, role, created_at FROM app_users WHERE id = ${userId}
  `
  return success(updated)
}

// Deactivating blocks the account's login immediately (see lib/auth.ts's
// authorize()) without touching the password or any of that person's
// historical data (payslips, times, violations all stay exactly as they
// are) -- for a staff member who's resigned, not someone being edited.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { session, error } = await requireAuth()
  if (error) return error
  const sessionUser = session?.user as any
  if (!isOwnerLevel(sessionUser)) return badRequest('Forbidden')

  const { id } = await params
  const userId = Number(id)
  if (String(sessionUser?.id) === id) {
    return badRequest('You can\'t deactivate your own account')
  }

  const { active, resigned_at, reason } = await req.json() as { active: boolean; resigned_at?: string | null; reason?: string | null }
  if (typeof active !== 'boolean') return badRequest('active is required')

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${userId}`
  if (!target) return notFound()

  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  if (targetIsProtected) return badRequest('The owner account can\'t be deactivated')

  await ensureSchema()

  const effectiveResignedAt = active ? null : (resigned_at || new Date().toISOString().slice(0, 10))
  const effectiveReason = active ? null : (reason?.trim() || 'Resigned')

  const [row] = await sql`
    UPDATE app_users SET active = ${active}, resigned_at = ${effectiveResignedAt}, deactivation_reason = ${effectiveReason}
    WHERE id = ${userId}
    RETURNING id, username, display_name, email, role, active, resigned_at::text, deactivation_reason
  `

  const actor = sessionUser?.username ?? sessionUser?.name ?? 'Unknown'
  await logActivity(
    actor,
    active ? 'reactivated staff account' : 'deactivated staff account',
    active ? target.username : `${target.username} — ${effectiveReason} (${effectiveResignedAt})`
  )

  return success(row)
}
