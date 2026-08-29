// Shared by Live Sale's Log mode (item/page.tsx) and the Home feed
// (TodayContent.tsx) for the same "time since the previous logged activity"
// figure, so the two never drift apart. Negative values (clock skew, a
// count entered wrong, or an activity logged before the day's first
// reference point) show as "-12m" rather than being hidden, since that
// itself is worth noticing.
export function formatGapMins(mins: number): string {
  const sign = mins < 0 ? '-' : ''
  const abs = Math.round(Math.abs(mins))
  if (abs < 60) return `${sign}${abs}m`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}h${m ? String(m).padStart(2, '0') : ''}`
}
