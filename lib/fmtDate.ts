const DAY = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
const MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

function ordinal(n: number) {
  if (n === 1 || n === 21 || n === 31) return 'st'
  if (n === 2 || n === 22) return 'nd'
  if (n === 3 || n === 23) return 'rd'
  return 'th'
}

export function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
  if (isNaN(d.getTime())) return String(raw)
  const day = d.getDate()
  const yr = String(d.getFullYear()).slice(-2)
  return `${day} ${MON[d.getMonth()]} '${yr}-${DAY[d.getDay()]}`
}

// "9:14am" -- the clock time a count/event happened, alongside its date
// rather than replacing it. Ghana runs on UTC year-round with no DST (see
// daily-summary's own comment on this), so a plain local Date read here
// lines up with shop time on any device actually in Ghana, same assumption
// fmtDate above already makes.
export function fmtTime(raw: string | null | undefined): string {
  if (!raw) return ''
  const d = new Date(raw)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12 || 12
  return `${h}:${String(m).padStart(2, '0')}${ampm}`
}

const MON_FULL_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// "2nd Jun 2026" -- used for the Task Assigned On note on personalized assignment messages.
export function fmtOrdinalDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
  if (isNaN(d.getTime())) return String(raw)
  const day = d.getDate()
  return `${day}${ordinal(day)} ${MON_FULL_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

// Whole days between two timestamps -- used for "took N days to complete"
// on tasks (created_at vs completed_at). Rounds rather than floors so a task
// finished a few hours into the next calendar day still reads as "1 day",
// not "0".
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  return Math.max(0, Math.round(ms / 86400000))
}
