import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { getRolePermissionsMap } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

// Any authenticated user can read the full matrix -- it's just feature
// flags, not sensitive, and every client needs it to render their own pane
// correctly. Only owner-level can change it.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })
  const map = await getRolePermissionsMap()
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role_key, feature_key, allowed } = await req.json()
  if (!role_key || !feature_key || typeof allowed !== 'boolean') {
    return NextResponse.json({ error: 'role_key, feature_key, allowed required' }, { status: 400 })
  }
  await sql`
    INSERT INTO role_permissions (role_key, feature_key, allowed)
    VALUES (${role_key}, ${feature_key}, ${allowed})
    ON CONFLICT (role_key, feature_key) DO UPDATE SET allowed = ${allowed}
  `
  return NextResponse.json({ ok: true })
}
