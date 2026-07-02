import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
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
