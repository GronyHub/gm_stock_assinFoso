import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { logActivity } from '@/lib/logger'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

type Ctx = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  const sessionUser = session?.user as any
  const { id } = await params
  const userId = Number(id)
  const isSelf = String(sessionUser?.id) === id

  // Owner and Joe can edit anyone; everyone else can only edit themselves
  if (!isOwnerLevel(sessionUser) && !isSelf) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${userId}`
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // The owner account itself can only be edited by the real owner, not by Joe's owner-level access
  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  const canEditTarget = isSelf || sessionUser?.role === 'owner' || (isOwnerLevel(sessionUser) && !targetIsProtected)
  if (!canEditTarget) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { display_name, email, role, password } = await req.json()

  if (display_name !== undefined) {
    const [row] = await sql`UPDATE app_users SET display_name = ${display_name} WHERE id = ${userId} RETURNING id`
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
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
  return NextResponse.json(updated)
}

// Deactivating blocks the account's login immediately (see lib/auth.ts's
// authorize()) without touching the password or any of that person's
// historical data (payslips, times, violations all stay exactly as they
// are) -- for a staff member who's resigned, not someone being edited.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!isOwnerLevel(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const userId = Number(id)
  if (String(sessionUser?.id) === id) {
    return NextResponse.json({ error: 'You can’t deactivate your own account' }, { status: 400 })
  }

  const { active, resigned_at } = await req.json() as { active: boolean; resigned_at?: string | null }
  if (typeof active !== 'boolean') return NextResponse.json({ error: 'active is required' }, { status: 400 })

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${userId}`
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  if (targetIsProtected) return NextResponse.json({ error: 'The owner account can’t be deactivated' }, { status: 403 })

  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`.catch(() => {})
  await sql`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS resigned_at DATE`.catch(() => {})

  const effectiveResignedAt = active ? null : (resigned_at || new Date().toISOString().slice(0, 10))

  const [row] = await sql`
    UPDATE app_users SET active = ${active}, resigned_at = ${effectiveResignedAt}
    WHERE id = ${userId}
    RETURNING id, username, display_name, email, role, active, resigned_at::text
  `

  const actor = sessionUser?.username ?? sessionUser?.name ?? 'Unknown'
  await logActivity(
    actor,
    active ? 'reactivated staff account' : 'deactivated staff account',
    active ? target.username : `${target.username} — resigned ${effectiveResignedAt}`
  )

  return NextResponse.json(row)
}
