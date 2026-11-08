// Client-safe definitions for the Daily Checklist (the picture-tile version of Standards). Ghana is on GMT, so
// UTC days are the shop's days.
// The usual groups, in the order they show. A group is just a name: the Tile Manager can create any other group and
// those follow these.
export const CHECK_SECTIONS = ['Opening', 'Daytime', 'Stations', 'Staff', 'Social media', 'Closing', 'Grony 2', 'Weekly', 'Monthly', 'Equipment'] as string[]
export type CheckSection = string
export const TILE_KINDS = ['tap', 'question', 'persons', 'entry', 'properties'] as const
export type TileKind = typeof TILE_KINDS[number]
export const KIND_LABEL: Record<string, string> = { tap: 'Tick when done', question: 'Question (all good / report a problem)', persons: 'Tick each person present', entry: 'Write a note or photo', properties: 'Opens a list of items' }
// The log (Grony Manage) each kind of record also goes into, so those pages keep their history.
export const LOG_CATEGORIES_FOR_TILES: { key: string; label: string }[] = [
  { key: '', label: 'None (history in the checklist only)' }, { key: 'cleanliness', label: 'Cleanliness' }, { key: 'arrangement', label: 'Arrangement' },
  { key: 'team_behaviour_log', label: 'Team Behaviour' }, { key: 'staff_dress_log', label: 'Team Dress Code' }, { key: 'unfortunate_events_log', label: 'Unfortunate Events' },
  { key: 'customer_display', label: 'Customer Display' }, { key: 'repair_works', label: 'Repair Works' }, { key: 'quality_assurance', label: 'Quality Assurance' }, { key: 'staff_display', label: 'Team Display' },
]
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly', 'once'] as const
export type Frequency = typeof FREQUENCIES[number]
export const CHECKLIST_START = '2026-11-05'

export type CheckTile = {
  id: number; section: string; time: string | null; title: string; icon: string; how: string | null
  kind: TileKind; prop_filter: string | null; frequency: Frequency; weekday: string | null; position: number
  days: string | null; ask: string | null; ok_label: string | null; issue_label: string | null; log_category: string | null; needs_photo: boolean
  category: string | null; subcategory: string | null; law_id: number | null
  minutes: number | null   // work time credited to whoever ticks it (shows in the worked time at the top of the pages)
}
export type CheckEvent = {
  id: number; tile_id: number; day: string; value: string; note: string | null
  extra: { done_at?: string; answer?: 'ok' | 'issue'; persons?: Record<string, 'ok' | 'not'>; about_staff?: string; photo_url?: string } | null; recorded_by: string; recorded_at: string
}

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const WEEKDAY_LABEL: Record<string, string> = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }

// The same choices as the Properties section of Expenses.
export const PROPERTY_LOCATIONS = Array.from({ length: 10 }, (_, i) => `Grony ${i + 1}`)
export const NOT_WORKING_REASONS = ['Faulty - Needs Repair', 'Condemned - Beyond Repairs']
export const NOT_AVAILABLE_REASONS = ['Spoilt and thrown away', 'Stolen', "At Grony's House"]

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)
const utc = (day: string) => new Date(day + 'T00:00:00Z')
export const addDays = (day: string, n: number) => { const d = utc(day); d.setUTCDate(d.getUTCDate() + n); return dayKey(d) }
export const weekStart = (day: string) => { const d = utc(day); const w = (d.getUTCDay() + 6) % 7; return addDays(day, -w) }
export const dayLabel = (day: string) => utc(day).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// Does an event on `evDay` count for a tile of this frequency when looking at `day`?
export function inPeriod(freq: Frequency, evDay: string, day: string): boolean {
  if (evDay > day) return false
  if (freq === 'daily') return evDay === day
  if (freq === 'weekly') return evDay >= weekStart(day)
  if (freq === 'monthly') return evDay.slice(0, 7) === day.slice(0, 7)
  if (freq === 'yearly') return evDay.slice(0, 4) === day.slice(0, 4)
  return true // once: done for good
}
export const PERIOD_WORD: Record<Frequency, string> = { daily: 'today', weekly: 'this week', monthly: 'this month', yearly: 'this year', once: 'once' }

// A picture for a task, chosen from its words.
const ICONS: [RegExp, string][] = [
  [/clock(ed)? in|clock out|team times/i, '⏰'], [/printer|toner|ink\b|cartridge/i, '🖨️'], [/scan/i, '📠'], [/photocop/i, '📄'],
  [/clean|sweep|mop|dust|wash|tidy|wipe|bin\b|rubbish|waste/i, '🧹'], [/fire|extinguisher|alarm|smoke/i, '🧯'], [/cctv|camera|security|lock|door|shutter|padlock/i, '🔒'],
  [/power|electric|light|bulb|generator|ups\b|socket|extension/i, '💡'], [/water|tap\b|tank|plumb/i, '🚰'], [/music|jingle|audio|sound|mic\b|speaker|voiceover/i, '🔊'],
  [/tv\b|screen|monitor|display|showcase|advert|banner|signboard/i, '📺'], [/facebook|meta|tiktok|instagram|post|clips?|capcut|status|social/i, '📱'], [/whatsapp|message|greeting|broadcast|group/i, '💬'],
  [/customer|register|GM number|queue|welcome/i, '🧑‍🤝‍🧑'], [/receipt|invoice|sale|sales|price|cash|money|momo|bank|payment/i, '🧾'], [/stock|count|item|inventory|shelf|shelves|group/i, '📦'],
  [/computer|laptop|pc\b|windows|usb|keyboard|mouse|software|app\b|apps\b|anydesk|chrome|update/i, '💻'], [/paper|a4|a3|sheets|envelope|lamination|4x6|5x7/i, '📄'],
  [/phone|sim\b|airtime|charger/i, '📞'], [/meeting|training|staff|owner|report/i, '👥'], [/repair|fix|faulty|broken|solder/i, '🔧'], [/photo|video|shoot|edit/i, '📸'],
  [/sticker|label|poster|checklist|laws?\b|rules?/i, '🏷️'], [/fan\b|ac\b|air|ventilat/i, '🌀'], [/seat|chair|table|furniture|arrange|display/i, '🪑'],
]
const SECTION_ICON: Record<string, string> = { Opening: '🌅', Daytime: '☀️', Stations: '🖥️', 'Social media': '📱', Closing: '🌙', 'Grony 2': '2️⃣', Weekly: '📅', Monthly: '🗓️', Equipment: '🔧' }
export function pickIcon(text: string, section: string): string {
  for (const [re, ic] of ICONS) if (re.test(text)) return ic
  return SECTION_ICON[section] ?? '✅'
}

// When each timed daily tile is really due today. The day starts when the first staff member clocks in (nothing is
// due, and nothing is late, before that). Tiles whose time was before that moment are queued one after another from
// the clock-in time, each taking its own minutes; every other tile is due at its own time. Minutes since midnight.
export function effectiveDue(tiles: { id: number; time: string | null; minutes: number | null; frequency: string; kind: string }[], dayStart: number | null): Map<number, number> {
  const out = new Map<number, number>()
  if (dayStart == null) return out
  const hm = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
  const timed = tiles.filter(t => t.kind !== 'properties' && t.frequency === 'daily' && t.time && /^\d\d:\d\d$/.test(t.time))
    .sort((a, b) => a.time!.localeCompare(b.time!) || a.id - b.id)
  let cursor = dayStart
  for (const t of timed) {
    const own = hm(t.time!)
    if (own < dayStart) { out.set(t.id, cursor); cursor += Math.max(1, t.minutes ?? 5) } else out.set(t.id, own)
  }
  return out
}

// Does this tile appear on `day`? `days` is a comma list of weekday codes (empty = every day).
export function appliesOn(t: { days?: string | null }, day: string): boolean {
  if (!t.days) return true
  return t.days.split(',').map(x => x.trim()).filter(Boolean).includes(WEEKDAYS[utc(day).getUTCDay()])
}
