// Shared between /api/staff-times/worked-today (the present-staff banner
// above the tab switcher, see PresentStaffBar.tsx), /api/staff-times/
// worked-detail, /api/announcements/daily-totals, and TodayContent.tsx's
// own per-row/per-staff Total column on the Home feed -- all four need to
// agree on exactly the same number for the same activity, or the feed and
// the banner would silently show different totals for the same staff.
//
// Only a live sale tap computes a real estimated_duration_seconds today
// (see lib/logger.ts); everything else logged via logActivity leaves it
// null. For those, every distinct action (see lib/activityDurations.ts --
// its own list is pulled from every category ever seen in `announcements`)
// gets DEFAULT_ACTIVITY_DURATION_SECONDS unless the owner has set their own
// value for it via Settings > Activity Times, in `durationOverrides` (a
// plain {action: seconds} map -- callers fetch it themselves, server-side
// via getActivityDurationOverrides() or client-side via
// GET /api/activity-durations, since this file is imported from a client
// component too and can't reach the database directly).
export const DEFAULT_ACTIVITY_DURATION_SECONDS = 60

export function effectiveDurationSeconds(
  category: string | null | undefined,
  estimatedDurationSeconds: number | null | undefined,
  durationOverrides?: Record<string, number> | null,
): number {
  if (estimatedDurationSeconds != null) return Number(estimatedDurationSeconds)
  if (category && durationOverrides && durationOverrides[category] != null) return durationOverrides[category]
  return DEFAULT_ACTIVITY_DURATION_SECONDS
}
