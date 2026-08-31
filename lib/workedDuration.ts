// Shared between /api/staff-times/worked-today (the present-staff banner
// above the tab switcher, see PresentStaffBar.tsx) and TodayContent.tsx's
// own per-row/per-staff Total column on the Home feed -- both need to
// agree on exactly the same number for the same activity, or the feed and
// the banner would silently show different totals for the same staff.
//
// Only a live sale tap computes a real estimated_duration_seconds today
// (see lib/logger.ts). Everything else logged via logActivity leaves it
// null unless explicitly passed -- entering or editing a bill/expense
// passes a flat 30s, and a stock count or a genuine violation-fix action
// (below) has no duration of its own at all, so it's credited a flat 1
// minute here rather than counting as zero real work.
export const FLAT_MINUTE_ACTIONS = new Set([
  'counted stock', 'reported count gain', 'reported count loss', 'confirmed opening counts',
  'merged items', 'marked as different items', 'marked all as different items',
  'linked unresolved sales lines to item', 'confirmed VCP jump as correct',
])

export function effectiveDurationSeconds(category: string | null | undefined, estimatedDurationSeconds: number | null | undefined): number {
  if (estimatedDurationSeconds != null) return Number(estimatedDurationSeconds)
  if (category && FLAT_MINUTE_ACTIONS.has(category)) return 60
  return 0
}
