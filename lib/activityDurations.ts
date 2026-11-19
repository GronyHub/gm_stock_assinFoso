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
export async function listKnownActivityActions(): Promise<{ action: string; count: number; current: boolean }[]> {
  await ensureSchema()
  const rows = await sql`
    SELECT category AS action, COUNT(*)::int AS count
    FROM announcements
    WHERE category IS NOT NULL
    GROUP BY category
  ` as unknown as { action: string; count: number }[]
  const seen = new Map(rows.map(r => [r.action, r.count]))
  const out = [...rows.map(r => ({ action: r.action, count: r.count, current: isCurrentActivity(r.action) }))]
  for (const a of APP_ACTIVITY_ACTIONS) if (!seen.has(a)) out.push({ action: a, count: 0, current: true })
  return out.sort((x, y) => Number(y.current) - Number(x.current) || y.count - x.count || x.action.localeCompare(y.action))
}

// Every kind of activity the app can log today (a scan of its logActivity / recordActivity calls), so Settings > Activity Times lists each one to set, even before it has ever been logged.
// An activity found in the log but not here is no longer produced by the app (shown apart, as history). 'logged <log name>' comes from the Manage logs and is always current.
export const APP_ACTIVITY_ACTIONS: string[] = [
  "added a penalty point",
  "added bill",
  "added bill expense",
  "added customer",
  "added customer number",
  "added expense",
  "added expense order",
  "added item photo",
  "added item photo (Wikimedia Commons)",
  "added receipt",
  "added sale receipt",
  "added vendor",
  "answered a question group",
  "answered part of a question group",
  "answered the closing report",
  "answered the question of the day right",
  "answered the question of the day wrong",
  "approved a clock-in time",
  "approved a clock-out time",
  "approved a dismissal",
  "approved a suspension",
  "approved extra time",
  "did not approve extra time",
  "assigned task",
  "built payslips",
  "changed main number",
  "changed their profile PIN",
  "clocked a colleague in",
  "clocked a colleague out",
  "clocked in",
  "clocked out",
  "clocked someone out after no confirmation",
  "clocked someone out automatically",
  "completed a CCTV review",
  "confirmed VCP jump as correct",
  "confirmed a violation",
  "confirmed alias match as correct",
  "confirmed cash at bank",
  "confirmed item as correct (cleared Needs Review)",
  "confirmed opening counts",
  "confirmed payroll payment",
  "confirmed still at the shop",
  "counted stock",
  "created purchase order",
  "deactivated staff account",
  "decided not to apply a sanction",
  "deleted bill",
  "deleted bill expense",
  "deleted customer",
  "deleted expense",
  "deleted expense order",
  "deleted item",
  "deleted property",
  "deleted purchase order line",
  "deleted sale receipt",
  "deleted stock count",
  "deleted time entry",
  "edited bill",
  "edited bill line",
  "edited customer",
  "edited expense",
  "edited expense order",
  "edited property",
  "edited purchase order",
  "edited stock count",
  "edited time entry",
  "edited vendor",
  "entered Cash Counted",
  "entered time",
  "excluded staff from payroll payment",
  "excused the manager block",
  "finished a pending job",
  "handed over a pending job",
  "issued receipt",
  "left a pending job",
  "linked a barcode",
  "linked unresolved sales lines to item",
  "live sale tap",
  "logged a violation for confirmation",
  "made a pending job from a paid sale",
  "marked GMC tap as property",
  "marked a task not done",
  "marked advert missing",
  "marked advert recorded",
  "marked all as different items",
  "marked as different items",
  "marked no-work day",
  "merged items",
  "migrated expense to bill",
  "posted announcement",
  "reactivated staff account",
  "received purchase order items",
  "recorded violation",
  "refunded money on a pending job",
  "removed customer number",
  "renamed group",
  "reopened a pending job",
  "reported an absence",
  "reported being late",
  "reported count gain",
  "reported count loss",
  "reset a profile PIN",
  "reset purchase orders to not received",
  "restored staff to payroll payment",
  "said others are still at the shop",
  "said these staff are not at the shop",
  "set a profile PIN",
  "signed laws",
  "skipped Cash Counted at clock-out",
  "skipped the start-of-day block",
  "started viewing portal as",
  "stopped viewing portal as",
  "submitted Advert daily checklist",
  "submitted closing report",
  "took a law quiz",
  "took a payment on a pending job",
  "took back a penalty point",
  "unmerged items",
  "updated purchase order",
]

// Activities with their own source of minutes, so the number typed here does not apply to them.
export const ACTIVITY_NOTES: Record<string, string> = {
  'live sale tap': 'Calculated from the sale itself; this number is not used.',
  'checklist task': 'Set on each task (its minutes in the law); this number is not used.',
}
export const isCurrentActivity = (action: string) => APP_ACTIVITY_ACTIONS.includes(action) || action.startsWith('logged ') || action in ACTIVITY_NOTES

// Where an activity's minutes are set: the Grony Cash pages (money, records, stock, customers, receipts) or Grony Manage (staff, checks, reports, penalties, jobs, adverts).
const CASH_RE = /bill|expense|purchase order|vendor|receipt|customer|number|sale|stock|count|item|barcode|property|cash|merged|unmerged/i
export const activityGroup = (action: string): 'cash' | 'manage' => (/payroll|payslip|clocked|time entry|clock-/i.test(action) ? 'manage' : CASH_RE.test(action) ? 'cash' : 'manage')
