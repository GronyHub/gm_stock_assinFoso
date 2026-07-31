import sql from './db'
import { isOwnerLevel } from './roles'

// The full set of gateable features -- one row per (role, feature) in
// role_permissions. Keep this list and the feature_key values in the DB in
// sync; FEATURE_LABELS below is what the Roles screen displays.
export const FEATURE_KEYS = [
  'team', 'users', 'add_category', 'view_portal_as', 'uk', 'ch', 'pl', 'confidential_expenses',
] as const
export type FeatureKey = typeof FEATURE_KEYS[number]

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  team: 'Team (Team Payslips, All Staff)',
  users: 'Users (manage accounts)',
  add_category: 'Add/delete Manage categories',
  view_portal_as: 'View Portal As (impersonation)',
  uk: 'UK tab',
  ch: 'C&H tab',
  pl: 'P&L',
  confidential_expenses: 'Confidential expenses (e.g. Salaries)',
}

export type RolePermissionsMap = Record<string, Record<string, boolean>>

export async function getRolePermissionsMap(): Promise<RolePermissionsMap> {
  const rows = await sql`SELECT role_key, feature_key, allowed FROM role_permissions`
  const map: RolePermissionsMap = {}
  for (const r of rows) {
    if (!map[r.role_key]) map[r.role_key] = {}
    map[r.role_key][r.feature_key] = !!r.allowed
  }
  return map
}

// Additive on top of the app's existing owner-level check (role=owner or
// username=joe, see lib/roles.ts) -- that stays exactly as-is everywhere
// else it's already used (payslips, quizzes, staff violations, stock
// counts, and ~25 other places), so this never takes anything away from
// Joe/Grony. It only adds a second way IN: any role (manager, staff, or a
// custom one) can be granted one of these 8 specific features from the
// Roles screen without needing full owner-level access.
export function hasFeature(
  user: { role?: string | null; username?: string | null; name?: string | null } | null | undefined,
  feature: FeatureKey,
  permissionsMap: RolePermissionsMap,
): boolean {
  if (!user) return false
  if (isOwnerLevel(user as { role?: string; username?: string; name?: string | null })) return true
  if (!user.role) return false
  return !!permissionsMap[user.role]?.[feature]
}
