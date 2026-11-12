import sql from '@/lib/db'
import { once } from '@/lib/once'
import { pickIcon, TILE_KINDS, FREQUENCIES, WEEKDAYS } from '@/lib/dailyChecksShared'
export * from './dailyChecksShared'

// The Daily Checklist: tiles staff tap as the day goes by. First run builds the template from the Standards list
// (standards_items); after that it is edited from the page itself.
const WINDOW: Record<string, [string, string]> = {
  Opening: ['07:30', '09:00'], Daytime: ['09:15', '16:45'], Stations: ['08:30', '17:30'], 'Social media': ['10:00', '16:30'],
  Closing: ['17:30', '19:00'], 'Grony 2': ['08:00', '18:30'],
}
const DAYNAMES: Record<string, string> = { MONDAY: 'mon', TUESDAY: 'tue', WEDNESDAY: 'wed', THURSDAY: 'thu', FRIDAY: 'fri', SATURDAY: 'sat', SUNDAY: 'sun' }
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const fromMin = (m: number) => { const r = Math.round(m / 5) * 5; return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}` }

type SRow = { id: number; station: string; section: string; text: string; how: string | null; frequency: string; kind: string; position: number }
function place(r: SRow): { section: string; frequency: string } | null {
  if (r.kind !== 'check') return null
  const sec = r.section
  const code = /^([A-Z]\d?|\d)\./.exec(sec)?.[1] ?? ''
  // Equipment, power, security, display and systems: any frequency (a one-off is done for good once ticked).
  if (['J', 'K', 'L', 'M'].includes(code)) return { section: 'Equipment', frequency: r.frequency }
  if (r.station === 'Grony 2' && ['1', '2', '3'].includes(code) && r.frequency === 'daily') return { section: 'Grony 2', frequency: 'daily' }
  if (r.station === 'Grony 1 & 2' && r.frequency === 'daily') return { section: 'Stations', frequency: 'daily' }
  if (r.station === 'Shop' && r.frequency === 'daily') {
    if (code === 'A') return { section: 'Opening', frequency: 'daily' }
    if (['B', 'B2', 'B3'].includes(code)) return { section: 'Daytime', frequency: 'daily' }
    if (code === 'D') return { section: 'Social media', frequency: 'daily' }
    if (code === 'E') return { section: 'Closing', frequency: 'daily' }
    return null
  }
  if (r.frequency === 'weekly') return { section: 'Weekly', frequency: 'weekly' }
  if (r.frequency === 'monthly' || r.frequency === 'yearly') return { section: 'Monthly', frequency: r.frequency }
  return null
}

// One-time upgrade: every tile gets a work-time value (minutes) that is credited to whoever ticks it, and the
// tiles that only repeat a clock-in or clock-out (those have their own place in the app) are taken off the list.
// Past records are kept. Runs only while the minutes column does not exist yet.
// A tile can depend on a condition (e.g. 'pending_jobs': only asked for while the shop holds open pending jobs).
export const ensureTileCondition = once(async () => { await sql`ALTER TABLE daily_check_tiles ADD COLUMN IF NOT EXISTS condition TEXT`.catch(() => {}) })

async function migrateMinutes() {
  try {
    const [{ has }] = await sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'daily_check_tiles' AND column_name = 'minutes') AS has`
    if (has) return
    await sql`ALTER TABLE daily_check_tiles ADD COLUMN IF NOT EXISTS minutes INTEGER`
    await sql`UPDATE daily_check_tiles SET active = false WHERE active AND title ~* '^clocked (in|out)'`
    // Timed daily tiles: the gap to the next tile in the same section, kept between 3 and 15 minutes.
    await sql`
      WITH t AS (
        SELECT id, (substr(time, 1, 2)::int * 60 + substr(time, 4, 2)::int) AS m,
               LEAD(substr(time, 1, 2)::int * 60 + substr(time, 4, 2)::int) OVER (PARTITION BY section ORDER BY time, id) AS nm
        FROM daily_check_tiles WHERE time ~ '^[0-2][0-9]:[0-5][0-9]$'
      )
      UPDATE daily_check_tiles d SET minutes = LEAST(GREATEST(COALESCE(t.nm - t.m, 5), 3), 15)
      FROM t WHERE d.id = t.id AND d.frequency = 'daily' AND d.minutes IS NULL`
    await sql`UPDATE daily_check_tiles SET minutes = CASE WHEN kind = 'properties' THEN 10 WHEN frequency = 'weekly' THEN 15 WHEN frequency = 'monthly' THEN 20 WHEN frequency IN ('yearly', 'once') THEN 10 ELSE 5 END WHERE minutes IS NULL`
  } catch (e) { console.error('daily checks minutes migration failed:', e instanceof Error ? e.message : String(e)) }
}

// Columns for the richer tile kinds, and the first batch of Grony Manage tiles (added once).
async function migrateKinds() {
  try {
    await sql`ALTER TABLE daily_check_tiles
      ADD COLUMN IF NOT EXISTS days TEXT, ADD COLUMN IF NOT EXISTS ask TEXT, ADD COLUMN IF NOT EXISTS ok_label TEXT,
      ADD COLUMN IF NOT EXISTS issue_label TEXT, ADD COLUMN IF NOT EXISTS log_category TEXT,
      ADD COLUMN IF NOT EXISTS needs_photo BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS category TEXT, ADD COLUMN IF NOT EXISTS subcategory TEXT, ADD COLUMN IF NOT EXISTS law_id INTEGER,
      ADD COLUMN IF NOT EXISTS assignment TEXT NOT NULL DEFAULT 'all'`
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM daily_check_tiles WHERE created_by = 'manage-tiles-v1'`
    if (n > 0) return
    type T = { section: string; time: string; title: string; icon: string; kind: string; ask?: string; ok?: string; issue?: string; log?: string; photo?: boolean; minutes: number; how?: string }
    const tiles: T[] = [
      { section: 'Staff', time: '09:00', title: 'Dress code: everyone in the company T-shirt and employee tag', icon: '👕', kind: 'persons', ask: 'Is each person wearing the company T-shirt and the employee tag?', log: 'staff_dress_log', minutes: 3, how: 'Mark every staff member who is at work today. Anyone marked Not wearing is logged and the owner is told.' },
      { section: 'Staff', time: '15:30', title: 'Team behaviour: any negative behaviour by staff so far today?', icon: '🚦', kind: 'question', ok: 'None so far', issue: 'Report behaviour', log: 'team_behaviour_log', minutes: 3, how: 'Late, rude, on the phone with customers waiting, leaving the counter, arguing. Say None so far if all is well, or report it.' },
      { section: 'Staff', time: '17:30', title: 'Team behaviour (end of day): any negative behaviour by staff today?', icon: '🚦', kind: 'question', ok: 'None today', issue: 'Report behaviour', log: 'team_behaviour_log', minutes: 3 },
      { section: 'Closing', time: '18:20', title: 'Unfortunate events: did anything unfortunate happen today?', icon: '⚠️', kind: 'question', ok: 'Nothing happened', issue: 'Report an event', log: 'unfortunate_events_log', minutes: 3, how: 'A theft, accident, damage, dispute, power cut or anything that could affect the shop.' },
      { section: 'Opening', time: '08:45', title: 'Cleanliness check with a photo: floor, counter, tables, toilets', icon: '🧹', kind: 'entry', log: 'cleanliness', photo: true, minutes: 5, how: 'Take one clear photo of the shop floor and counter, and write anything that was dirty.' },
      { section: 'Daytime', time: '15:00', title: 'Cleanliness check with a photo (afternoon)', icon: '🧹', kind: 'entry', log: 'cleanliness', photo: true, minutes: 5 },
      { section: 'Opening', time: '08:50', title: 'Arrangement check with a photo: items and furniture in place', icon: '🪑', kind: 'entry', log: 'arrangement', photo: true, minutes: 5, how: 'Photo of the arranged shop: all items in their places, chairs and tables neat.' },
      { section: 'Closing', time: '18:55', title: 'Closing questions answered in the app (Closer)', icon: '🔐', kind: 'tap', minutes: 5, how: 'Open the Closer page and answer the closing questions before you clock out.' },
    ]
    let pos = 1000
    for (const t of tiles) {
      await sql`INSERT INTO daily_check_tiles (section, time, title, icon, how, kind, frequency, position, minutes, ask, ok_label, issue_label, log_category, needs_photo, created_by)
        VALUES (${t.section}, ${t.time}, ${t.title}, ${t.icon}, ${t.how ?? null}, ${t.kind}, 'daily', ${pos++}, ${t.minutes}, ${t.ask ?? null}, ${t.ok ?? null}, ${t.issue ?? null}, ${t.log ?? null}, ${!!t.photo}, 'manage-tiles-v1')`
    }
  } catch (e) { console.error('daily checks kinds migration failed:', e instanceof Error ? e.message : String(e)) }
}

async function ensureImpl() {
  await sql`CREATE TABLE IF NOT EXISTS daily_check_tiles (
    id SERIAL PRIMARY KEY, section TEXT NOT NULL, time TEXT, title TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '✅', how TEXT,
    kind TEXT NOT NULL DEFAULT 'tap', prop_filter TEXT, frequency TEXT NOT NULL DEFAULT 'daily', weekday TEXT,
    position INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT TRUE, source_id INTEGER,
    created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS daily_check_events (
    id SERIAL PRIMARY KEY, tile_id INTEGER NOT NULL, day TEXT NOT NULL, value TEXT NOT NULL, note TEXT, extra JSONB,
    recorded_by TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS daily_check_events_day ON daily_check_events (day)`.catch(() => {})
  await migrateMinutes()
  await ensureTileCondition()
  await migrateKinds()
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM daily_check_tiles`
  if (n > 0) return
  const rows = await sql`SELECT id, station, section, text, how, frequency, kind, position FROM standards_items WHERE active ORDER BY id`.catch(() => []) as SRow[]
  const groups = new Map<string, { r: SRow; frequency: string }[]>()
  for (const r of rows) {
    const p = place(r); if (!p) continue
    if (!groups.has(p.section)) groups.set(p.section, [])
    groups.get(p.section)!.push({ r, frequency: p.frequency })
  }
  // Hand-made tiles that open a list (same Available / Working / Location choices as Properties in Expenses).
  const listTiles: { section: string; time: string; title: string; icon: string; filter: string }[] = [
    { section: 'Opening', time: '08:20', title: 'Mark printers', icon: '🖨️', filter: 'printer' },
    { section: 'Equipment', time: '', title: 'Mark computers and screens', icon: '💻', filter: 'computer,laptop,monitor,screen,keyboard' },
    { section: 'Equipment', time: '', title: 'Mark cameras and lights', icon: '📸', filter: 'camera,light,tripod,lens' },
    { section: 'Equipment', time: '', title: 'Mark sound equipment', icon: '🔊', filter: 'speaker,mic,mixer,sound,headphone' },
  ]
  let pos = 0
  const pending: { section: string; time: string | null; title: string; icon: string; how: string | null; frequency: string; weekday: string | null; source_id: number; position: number }[] = []
  for (const lt of listTiles) {
    await sql`INSERT INTO daily_check_tiles (section, time, title, icon, kind, prop_filter, frequency, position, created_by)
      VALUES (${lt.section}, ${lt.time || null}, ${lt.title}, ${lt.icon}, 'properties', ${lt.filter}, ${lt.section === 'Opening' ? 'daily' : 'weekly'}, ${pos++}, 'template')`.catch(() => {})
  }
  for (const [section, list] of groups) {
    const win = WINDOW[section]
    const timed = list.filter(x => x.frequency === 'daily')
    list.forEach(({ r, frequency }, i) => {
      let time: string | null = null
      if (win && frequency === 'daily') {
        const idx = timed.findIndex(x => x.r.id === r.id)
        const span = toMin(win[1]) - toMin(win[0])
        time = fromMin(toMin(win[0]) + (timed.length > 1 ? Math.round((span * idx) / (timed.length - 1)) : 0))
      }
      const day = Object.keys(DAYNAMES).find(d => r.text.toUpperCase().startsWith(d + ':'))
      void i
      pending.push({ section, time, title: r.text.slice(0, 240), icon: pickIcon(r.text, section), how: r.how, frequency, weekday: day ? DAYNAMES[day] : null, source_id: r.id, position: pos++ })
    })
  }
  for (const t of pending) {
    await sql`INSERT INTO daily_check_tiles (section, time, title, icon, how, kind, frequency, weekday, position, source_id, created_by)
      VALUES (${t.section}, ${t.time}, ${t.title}, ${t.icon}, ${t.how}, 'tap', ${t.frequency}, ${t.weekday}, ${t.position}, ${t.source_id}, 'template')`.catch(() => {})
  }
}
export const ensureDailyChecks = once(ensureImpl)

export const WORK_CATEGORY = 'checklist task'
// Logs a ticked tile as an activity worth `minutes` of work for `who` (source_id = the checklist record's id).
export async function creditWork(who: string, title: string, minutes: number, eventId: number) {
  try {
    await sql`INSERT INTO announcements (body, author, media_urls, category, estimated_duration_seconds, source_id)
      VALUES (${'Daily checklist: ' + title}, ${who}, '[]'::jsonb, ${WORK_CATEGORY}, ${Math.max(0, minutes) * 60}, ${eventId})`
  } catch (e) { console.error('daily checks credit failed:', e instanceof Error ? e.message : String(e)) }
}
export async function removeCredit(eventId: number) {
  await sql`DELETE FROM announcements WHERE category = ${WORK_CATEGORY} AND source_id = ${eventId}`.catch(() => {})
}

const HMRE = /^([01]\d|2[0-3]):[0-5]\d$/
// One place that cleans a tile sent from the Tile Manager / add form, so adding and editing agree.
export function parseTileBody(b: any) {
  const clean = (v: unknown, n: number) => { const x = String(v ?? '').trim().slice(0, n); return x || null }
  const frequency = (FREQUENCIES as readonly string[]).includes(b.frequency) ? String(b.frequency) : 'daily'
  const kind = (TILE_KINDS as readonly string[]).includes(b.kind) ? String(b.kind) : 'tap'
  const days = Array.isArray(b.days) ? b.days : String(b.days ?? '').split(',')
  const validDays = (WEEKDAYS as readonly string[])
  const dayList = days.map((d: unknown) => String(d).trim().toLowerCase()).filter((d: string) => validDays.includes(d))
  const mins = Math.round(Number(b.minutes))
  return {
    title: String(b.title ?? '').trim().slice(0, 240),
    section: String(b.section ?? '').trim().slice(0, 40),
    time: HMRE.test(b.time ?? '') ? String(b.time) : null,
    icon: String(b.icon || '✅').slice(0, 8),
    how: clean(b.how, 600),
    kind, frequency,
    prop_filter: kind === 'properties' ? String(b.prop_filter ?? '').slice(0, 200) : null,
    weekday: frequency === 'weekly' && validDays.includes(String(b.weekday ?? '')) ? String(b.weekday) : null,
    days: dayList.length && dayList.length < 7 ? dayList.join(',') : null,
    minutes: Number.isFinite(mins) && mins >= 0 && mins <= 240 ? mins : 5,
    ask: clean(b.ask, 200), ok_label: clean(b.ok_label, 40), issue_label: clean(b.issue_label, 40),
    log_category: clean(b.log_category, 60), needs_photo: !!b.needs_photo,
  }
}

export const ADHOC_CATEGORY = 'ad hoc activity'
export const ADHOC_DAILY_CAP_MIN = 60   // most ad hoc minutes credited to one person in a day
export const ADHOC_ENTRY_MAX_MIN = 60
export const ensureAdhoc = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS daily_adhoc (
    id SERIAL PRIMARY KEY, day TEXT NOT NULL, category TEXT NOT NULL, note TEXT NOT NULL, photo_url TEXT,
    minutes INTEGER NOT NULL DEFAULT 0, credited INTEGER NOT NULL DEFAULT 0, recorded_by TEXT NOT NULL, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS daily_adhoc_day ON daily_adhoc (day)`.catch(() => {})
})
