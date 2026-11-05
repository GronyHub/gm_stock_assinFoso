// Client-safe definitions for the Daily Checklist (the picture-tile version of Standards). Ghana is on GMT, so
// UTC days are the shop's days.
export const CHECK_SECTIONS = ['Opening', 'Daytime', 'Stations', 'Social media', 'Closing', 'Grony 2', 'Weekly', 'Monthly', 'Equipment'] as const
export type CheckSection = typeof CHECK_SECTIONS[number]
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly', 'once'] as const
export type Frequency = typeof FREQUENCIES[number]
export const CHECKLIST_START = '2026-11-05'

export type CheckTile = {
  id: number; section: string; time: string | null; title: string; icon: string; how: string | null
  kind: 'tap' | 'properties'; prop_filter: string | null; frequency: Frequency; weekday: string | null; position: number
}
export type CheckEvent = {
  id: number; tile_id: number; day: string; value: string; note: string | null
  extra: { done_at?: string } | null; recorded_by: string; recorded_at: string
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
