import { requireAuth, badRequest, success, unauthorized } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { FEATURE_KEYS, DEFAULT_ON_FEATURES } from '@/lib/permissions'
import { NextRequest } from 'next/server'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return unauthorized()
  const rows = await sql`SELECT key, label, created_at FROM roles ORDER BY created_at`
  return success(rows)
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) {
    return badRequest('Forbidden')
  }

  const { label } = await req.json()
  if (!label?.trim()) return badRequest('label required')

  const key = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!key) return badRequest('label must contain at least one letter or number')

  const [existing] = await sql`SELECT key FROM roles WHERE key = ${key}`
  if (existing) return badRequest('A role with that name already exists')

  const [row] = await sql`INSERT INTO roles (key, label) VALUES (${key}, ${label.trim()}) RETURNING key, label, created_at`
  for (const feature of FEATURE_KEYS) {
    await sql`INSERT INTO role_permissions (role_key, feature_key, allowed) VALUES (${key}, ${feature}, ${DEFAULT_ON_FEATURES.has(feature)})`
  }
  return success(row)
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as { role?: string; username?: string } | undefined)) {
    return badRequest('Forbidden')
  }

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return badRequest('key required')
  if (['owner', 'manager', 'staff'].includes(key)) {
    return badRequest('Cannot delete a built-in role')
  }
  const [inUse] = await sql`SELECT COUNT(*) FROM app_users WHERE role = ${key}`
  if (Number(inUse.count) > 0) {
    return badRequest(`${inUse.count} user(s) still have this role -- reassign them first`)
  }
  await sql`DELETE FROM roles WHERE key = ${key}`
  return success({ ok: true })
}
