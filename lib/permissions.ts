import sql from './db'

// Server-only: getRolePermissionsMap queries the database, so this file
// transitively imports lib/db.ts. Never import this file from a 'use
// client' component (item/page.tsx, roles/page.tsx) -- import from
// lib/permissionsShared.ts instead, which has everything client-safe
// (FEATURE_KEYS/FEATURE_LABELS/hasFeature) without pulling in the DB
// client. API routes (server-only) can keep importing from here.
export * from './permissionsShared'
import type { RolePermissionsMap } from './permissionsShared'

export async function getRolePermissionsMap(): Promise<RolePermissionsMap> {
  const rows = await sql`SELECT role_key, feature_key, allowed FROM role_permissions`
  const map: RolePermissionsMap = {}
  for (const r of rows) {
    if (!map[r.role_key]) map[r.role_key] = {}
    map[r.role_key][r.feature_key] = !!r.allowed
  }
  return map
}
