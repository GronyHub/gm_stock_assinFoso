import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { getUserPermissionsMap } from '@/lib/permissions'
import { NextRequest, NextResponse } from 'next/server'

// Any authenticated user can read the full matrix -- it's just feature
// flags, not sensitive, and every client needs it to render their own pane
// correctly. Only owner-level can change it.
export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({}, { status: 401 })
  const map = await getUserPermissionsMap()
  return NextResponse.json(map)
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_id, feature_key, allowed } = await req.json()
  if (!user_id || !feature_key || typeof allowed !== 'boolean') {
    return NextResponse.json({ error: 'user_id, feature_key, allowed required' }, { status: 400 })
  }
  await sql`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (user_id, feature_key)
    )
  `.catch(() => {})
  await sql`
    INSERT INTO user_permissions (user_id, feature_key, allowed)
    VALUES (${user_id}, ${feature_key}, ${allowed})
    ON CONFLICT (user_id, feature_key) DO UPDATE SET allowed = ${allowed}
  `
  return NextResponse.json({ ok: true })
}
