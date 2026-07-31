import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { FEATURE_KEYS } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

// Any authenticated user can read the role list (needed to render their own
// UI correctly) -- only owner-level can create or delete roles, since this
// is root configuration for the whole access system, not something a
// granted permission should be able to extend to itself.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })
  const rows = await sql`SELECT key, label, created_at FROM roles ORDER BY created_at`
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { label } = await req.json()
  if (!label?.trim()) return NextResponse.json({ error: 'label required' }, { status: 400 })

  const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!key) return NextResponse.json({ error: 'label must contain at least one letter or number' }, { status: 400 })

  const [existing] = await sql`SELECT key FROM roles WHERE key = ${key}`
  if (existing) return NextResponse.json({ error: 'A role with that name already exists' }, { status: 409 })

  const [row] = await sql`INSERT INTO roles (key, label) VALUES (${key}, ${label.trim()}) RETURNING key, label, created_at`
  for (const feature of FEATURE_KEYS) {
    await sql`INSERT INTO role_permissions (role_key, feature_key, allowed) VALUES (${key}, ${feature}, false)`
  }
  return NextResponse.json(row, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 })
  if (['owner', 'manager', 'staff'].includes(key)) {
    return NextResponse.json({ error: 'Cannot delete a built-in role' }, { status: 400 })
  }
  const [inUse] = await sql`SELECT COUNT(*) FROM app_users WHERE role = ${key}`
  if (Number(inUse.count) > 0) {
    return NextResponse.json({ error: `${inUse.count} user(s) still have this role -- reassign them first` }, { status: 409 })
  }
  await sql`DELETE FROM roles WHERE key = ${key}`
  return NextResponse.json({ ok: true })
}
