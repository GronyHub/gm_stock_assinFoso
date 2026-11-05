import sql from '@/lib/db'
import { once } from '@/lib/once'
import { pickIcon } from '@/lib/dailyChecksShared'
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
