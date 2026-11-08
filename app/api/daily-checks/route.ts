import { requireAuth, badRequest, getActorName, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { ensureDailyChecks, CHECK_SECTIONS, FREQUENCIES, CHECKLIST_START, dayKey } from '@/lib/dailyChecks'
import { getClockState, actorKey } from '@/lib/clockState'
import { NextRequest } from 'next/server'

const cleanMinutes = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 240 ? n : 5 }
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

// GET ?day=YYYY-MM-DD -> { tiles, events } : every tile, and the records that can still count on that day
// (that year's, plus one-off tasks done at any time).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureDailyChecks()
    const q = req.nextUrl.searchParams.get('day') ?? ''
    const today = dayKey()
    const day = /^\d{4}-\d{2}-\d{2}$/.test(q) && q >= CHECKLIST_START && q <= today ? q : today
    const tiles = await sql`SELECT id, section, time, title, icon, how, kind, prop_filter, frequency, weekday, position, minutes FROM daily_check_tiles WHERE active ORDER BY position, id`
    const events = await sql`
      SELECT e.id, e.tile_id, e.day, e.value, e.note, e.extra, e.recorded_by, e.recorded_at
      FROM daily_check_events e JOIN daily_check_tiles t ON t.id = e.tile_id
      WHERE e.day <= ${day} AND (e.day >= ${day.slice(0, 4) + '-01-01'} OR t.frequency = 'once') ORDER BY e.recorded_at, e.id`
    const clock = await getClockState(today)
    const me = actorKey(session.user as any)
    const exempt = (session.user as { role?: string })?.role === 'owner'
    return success({ day, today, tiles, events, dayStart: clock.dayStart, clockedIn: exempt || clock.present.includes(me), exempt, present: clock.present })
  } catch (e) { return handleError('daily-checks GET', e) }
}

// POST { section, title, time?, icon?, frequency?, kind?, prop_filter?, how? } -- managers only
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if ((session.user as { role?: string })?.role === 'staff') return badRequest('Only managers can change the checklist.')
  try {
    await ensureDailyChecks()
    const b = await req.json().catch(() => ({}))
    const title = String(b.title ?? '').trim().slice(0, 240)
    const section = String(b.section ?? '')
    if (!title || !(CHECK_SECTIONS as readonly string[]).includes(section)) return badRequest('Need a section and a title.')
    const time = HM.test(b.time ?? '') ? b.time : null
    const frequency = (FREQUENCIES as readonly string[]).includes(b.frequency) ? b.frequency : 'daily'
    const kind = b.kind === 'properties' ? 'properties' : 'tap'
    const [row] = await sql`INSERT INTO daily_check_tiles (section, time, title, icon, how, kind, prop_filter, frequency, position, created_by, minutes)
      VALUES (${section}, ${time}, ${title}, ${String(b.icon || '✅').slice(0, 8)}, ${b.how ? String(b.how).slice(0, 600) : null}, ${kind},
              ${kind === 'properties' ? String(b.prop_filter ?? '').slice(0, 200) : null}, ${frequency}, (SELECT COALESCE(MAX(position), 0) + 1 FROM daily_check_tiles), ${getActorName(session)}, ${cleanMinutes(b.minutes)})
      RETURNING id`
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('daily-checks POST', e) }
}
