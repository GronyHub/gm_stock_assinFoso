export function parseTimeMins(t: string | null): number | null {
  if (!t) return null
  const m = t.match(/^(\d+):(\d+)(am|pm)$/i)
  if (!m) return null
  let h = parseInt(m[1])
  const min = parseInt(m[2])
  const ap = m[3].toLowerCase()
  if (ap === 'pm' && h !== 12) h += 12
  if (ap === 'am' && h === 12) h = 0
  return h * 60 + min
}

// The Opener is the staff member with the earliest clock-in time today.
export function openerOf(rows: { staff_name?: string; actual_in?: string | null }[]): string | null {
  let best: string | null = null
  let bestMins = Infinity
  for (const r of rows) {
    const mins = parseTimeMins(r.actual_in ?? null)
    if (mins !== null && mins < bestMins) { bestMins = mins; best = r.staff_name ?? null }
  }
  return best
}
