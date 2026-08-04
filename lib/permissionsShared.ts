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
  'cash', 'manage', 'team', 'users', 'view_portal_as', 'uk', 'ch', 'pl', 'confidential_expenses',
] as const
export type FeatureKey = typeof FEATURE_KEYS[number]

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  cash: 'Grony Cash (Items, Sales, Bills, etc.)',
  manage: 'Grony Manage (Tasks, Opener, Closer, Audio, etc.)',
  team: 'Team (Times, Payments, Penalty Points, etc.)',
  users: 'Users (manage accounts)',
  view_portal_as: 'View Portal As (impersonation)',
  uk: 'UK tab',
  ch: 'C&H tab',
  pl: 'P&L',
  confidential_expenses: 'Confidential expenses (e.g. Salaries)',
}

// Every other feature here is an opt-in extra (off until someone's
// specifically granted it). Cash and Manage are the opposite -- they're
// the app's core, everyone had them before this permission even existed,
// so they need to stay on by default and only switch off for whoever's
// explicitly unchecked (see getUserPermissionsMap in lib/permissions.ts).
export const DEFAULT_ON_FEATURES = new Set<FeatureKey>(['cash', 'manage'])

export type RolePermissionsMap = Record<string, Record<string, boolean>>

// The one deliberate exception to the "never takes anything away from
// Joe/Grony" rule below -- Joe is still owner-level everywhere else (~25
// other places keep checking isOwnerLevel directly and are untouched by
// this), but the UK tab specifically is a real per-person checkbox for him
// too, toggled from the Roles & Permissions screen like any regular staff
// feature. True owner (role="owner", i.e. Grony) is never affected: the
// override below only fires for the username="joe" half of isOwnerLevel.
export const JOE_OVERRIDABLE_FEATURES = new Set<FeatureKey>(['uk'])

// Additive on top of the app's existing owner-level check (role=owner or
// username=joe, see lib/roles.ts) -- that stays exactly as-is everywhere
// else it's already used (payslips, quizzes, staff violations, stock
// counts, and ~25 other places), so this never takes anything away from
// Joe/Grony except for JOE_OVERRIDABLE_FEATURES above. It otherwise only
// adds a second way IN: any individual staff member can be granted one of
// these 8 specific features from the Roles & Permissions screen without
// needing full owner-level access. permissionsMap is keyed by username
// (see getUserPermissionsMap in lib/permissions.ts), not role -- each
// person is toggled independently, seeded from their role's defaults.
export function hasFeature(
  user: { role?: string | null; username?: string | null; name?: string | null } | null | undefined,
  feature: FeatureKey,
  permissionsMap: RolePermissionsMap,
): boolean {
  if (!user) return false
  const username = (user.username ?? user.name ?? '').toLowerCase()
  const joeOverridden = username === 'joe' && JOE_OVERRIDABLE_FEATURES.has(feature)
  if (!joeOverridden && isOwnerLevel(user as { role?: string; username?: string; name?: string | null })) return true
  if (!username) return false
  return !!permissionsMap[username]?.[feature]
}
