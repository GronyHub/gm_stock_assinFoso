// Shared by the item edit form's Time/unit field (ItemEditForm.tsx) and the
// Log tab's Time column/daily total (item/page.tsx) -- one place deciding
// what "2m 30s" actually looks like so the two never drift apart.
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds)
  if (s <= 0) return '0s'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`
  return `${sec}s`
}
