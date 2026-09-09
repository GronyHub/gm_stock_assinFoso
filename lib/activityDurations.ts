import sql from '@/lib/db'
import { once } from './once'

// Owner-editable overrides for effectiveDurationSeconds' default (see
// lib/workedDuration.ts) -- lets Settings > Activity Times set a real
// duration per logActivity action (e.g. "added bill" -> 5 minutes) instead
// of every unestimated activity falling back to the same flat default.
// Only ever holds an override row for an action someone has actually
// changed; anything else still falls back to the default in code, so a
// brand-new action type (a future logActivity call this table has never
// seen) works immediately without needing a migration to add it here.
const ensureSchema = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS activity_durations (
      action TEXT PRIMARY KEY,
      duration_seconds INTEGER NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

export async function getActivityDurationOverrides(): Promise<Record<string, number>> {
  await ensureSchema()
  const rows = await sql`SELECT action, duration_seconds FROM activity_durations`
  const map: Record<string, number> = {}
  for (const r of rows as { action: string; duration_seconds: number }[]) map[r.action] = Number(r.duration_seconds)
  return map
}

export async function setActivityDurationOverride(action: string, seconds: number | null, updatedBy: string): Promise<void> {
  await ensureSchema()
  if (seconds == null) {
    // Removing the override, not zeroing it out -- goes back to following
    // the default (or a future change to it) automatically.
    await sql`DELETE FROM activity_durations WHERE action = ${action}`
  } else {
    await sql`
      INSERT INTO activity_durations (action, duration_seconds, updated_by, updated_at)
      VALUES (${action}, ${seconds}, ${updatedBy}, now())
      ON CONFLICT (action) DO UPDATE SET duration_seconds = EXCLUDED.duration_seconds, updated_by = EXCLUDED.updated_by, updated_at = now()
    `
  }
}

// Every distinct action that has actually shown up as a Home feed
// activity, most-used first -- pulled from `announcements.category` (set
// to the raw logActivity action string, see lib/logger.ts) rather than a
// hardcoded list, so a new logActivity call anywhere in the app shows up
// here to configure the moment it's ever actually logged, with no code
// change needed on this side.
export async function listKnownActivityActions(): Promise<{ action: string; count: number }[]> {
  await ensureSchema()
  const rows = await sql`
    SELECT category AS action, COUNT(*)::int AS count
    FROM announcements
    WHERE category IS NOT NULL
    GROUP BY category
    ORDER BY count DESC, category ASC
  `
  return rows as unknown as { action: string; count: number }[]
}
