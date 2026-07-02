import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await sql`SELECT id, username, display_name, email, role, created_at FROM app_users ORDER BY id`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { username, display_name, email, role, password } = await req.json()
  if (!username || !password || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const hash = await bcrypt.hash(password, 12)
  const [row] = await sql`
    INSERT INTO app_users (username, display_name, email, role, password_hash)
    VALUES (${username}, ${display_name ?? username}, ${email ?? null}, ${role}, ${hash})
    RETURNING id, username, display_name, email, role, created_at
  `
  return NextResponse.json(row)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as any
  if (!isOwnerLevel(sessionUser)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id, role } = await req.json()
  if (!id || !role) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const [target] = await sql`SELECT username, role FROM app_users WHERE id = ${id}`
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const targetIsProtected = target.role === 'owner' || target.username?.toLowerCase() === 'grony'
  if (targetIsProtected && sessionUser?.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [row] = await sql`
    UPDATE app_users SET role = ${role} WHERE id = ${id}
    RETURNING id, username, display_name, role
  `
  return NextResponse.json(row)
}
