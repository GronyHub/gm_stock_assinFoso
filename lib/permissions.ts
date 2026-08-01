import sql from './db'

// Server-only: getUserPermissionsMap queries the database, so this file
// transitively imports lib/db.ts. Never import this file from a 'use
// client' component (item/page.tsx, roles/page.tsx) -- import from
// lib/permissionsShared.ts instead, which has everything client-safe
// (FEATURE_KEYS/FEATURE_LABELS/hasFeature) without pulling in the DB
// client. API routes (server-only) can keep importing from here.
export * from './permissionsShared'
import { FEATURE_KEYS, DEFAULT_ON_FEATURES, type RolePermissionsMap } from './permissionsShared'

// Per-user grants (Roles & Permissions screen is keyed by person, not role,
// so each staff member can be toggled individually) layered on top of their
// role's defaults -- a user with no explicit override for a feature still
// reads whatever their role currently grants, which is what seeds their
// checkboxes the first time this runs for them. hasFeature() below looks
// this map up by username instead of role once a caller passes it in here.
export async function getUserPermissionsMap(): Promise<RolePermissionsMap> {
  await sql`
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id INTEGER NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      feature_key TEXT NOT NULL,
      allowed BOOLEAN NOT NULL DEFAULT FALSE,
      PRIMARY KEY (user_id, feature_key)
    )
  `.catch(() => {})
  const [users, roleRows, overrideRows] = await Promise.all([
    sql`SELECT id, username, role FROM app_users`,
    sql`SELECT role_key, feature_key, allowed FROM role_permissions`,
    sql`SELECT user_id, feature_key, allowed FROM user_permissions`,
  ])
  const roleDefaults: RolePermissionsMap = {}
  for (const r of roleRows) {
    if (!roleDefaults[r.role_key]) roleDefaults[r.role_key] = {}
    roleDefaults[r.role_key][r.feature_key] = !!r.allowed
  }
  const overridesByUserId: Record<number, Record<string, boolean>> = {}
  for (const r of overrideRows) {
    if (!overridesByUserId[r.user_id]) overridesByUserId[r.user_id] = {}
    overridesByUserId[r.user_id][r.feature_key] = !!r.allowed
  }
  const map: RolePermissionsMap = {}
  for (const u of users) {
    const effective: Record<string, boolean> = {}
    for (const feature of FEATURE_KEYS) {
      const override = overridesByUserId[u.id]?.[feature]
      const roleValue = roleDefaults[u.role]?.[feature]
      effective[feature] = override !== undefined ? override
        : roleValue !== undefined ? roleValue
        : DEFAULT_ON_FEATURES.has(feature)
    }
    map[u.username.toLowerCase()] = effective
  }
  return map
}
