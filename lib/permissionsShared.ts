import { isOwnerLevel } from './roles'

// Client-safe half of lib/permissions.ts -- deliberately has NO import of
// lib/db.ts (directly or transitively). lib/db.ts runs `neon(process.env.
// DATABASE_URL!)` at module top level, which is fine server-side but throws
// immediately if that module ever ends up in a browser bundle (DATABASE_URL
// is never exposed client-side). item/page.tsx and roles/page.tsx are both
// 'use client' components -- they must only ever import from this file, not
// from lib/permissions.ts directly, or the bundler pulls lib/db.ts in with
// it and crashes every client on load.
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
