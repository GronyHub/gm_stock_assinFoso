import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { addDays, appliesOn, dayKey, WEEKDAYS } from '@/lib/dailyChecksShared'
import { rotaRolesBetween } from '@/lib/rota'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { ACTIVE_STAFF } from '@/lib/staffList'
import { NextRequest } from 'next/server'
import type { AheadItem, AheadDay } from '@/lib/todoAhead'

const ONE_OFF_LAW = 'Do the to-do items you are given by their date'
const dow = (d: string) => WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()]
const daysIn = (d: string) => new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0)).getUTCDate()

// GET ?from=YYYY-MM-DD&days=31 -- what each coming date holds: the daily duties of the Opener, the daytime and the Closer; the weekly and
// monthly laws on their days; and the one-off to-do items added for that date. The Opener and Closer are named from the rota.
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const q = req.nextUrl.searchParams
    const tomorrow = addDays(dayKey(), 1)
    const fromQ = q.get('from') ?? ''
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromQ) && fromQ >= tomorrow ? fromQ : tomorrow
    const days = Math.min(Math.max(Number(q.get('days')) || 31, 1), 120)
    const to = addDays(from, days - 1)
    const manager = isOwnerLevel(session.user as never)
    const tiles = await sql`SELECT t.id, t.title, t.time, t.minutes, t.frequency, t.days, t.weekday, t.assignment, l.id AS law_id, l.month_day, l.audience
      FROM daily_check_tiles t JOIN page_laws l ON l.id = t.law_id AND l.tile_id = t.id
      WHERE t.active AND l.status = 'live' AND t.kind <> 'properties' AND (${manager} OR l.audience <> 'managers')` as unknown as { id: number; title: string; time: string | null; minutes: number | null; frequency: string; days: string | null; weekday: string | null; assignment: string; law_id: number; month_day: number | null }[]
    const oneoff = await sql`SELECT id, title, notes, substr(due_date::text, 1, 10) AS d, assigned_to FROM custom_tasks WHERE submenu = 'To do' AND NOT COALESCE(done, false) AND substr(due_date::text, 1, 10) BETWEEN ${from} AND ${to}`.catch(() => []) as unknown as { id: number; title: string; notes: string | null; d: string; assigned_to: string | null }[]
    const rota = await rotaRolesBetween(from, to)
    const out: AheadDay[] = []
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const w = dow(d), items: AheadItem[] = []
      const r = rota[d] ?? null
      for (const t of tiles) {
        let hit = false, note: string | null = null
        if (t.frequency === 'daily') hit = w !== 'sun' && appliesOn(t, d)
        else if (t.frequency === 'weekly') hit = w === (t.weekday ?? (t.days ? t.days.split(',')[0].trim() : 'mon'))
        else if (t.frequency === 'monthly') {
          if (t.month_day) hit = Number(d.slice(8)) === Math.min(t.month_day, daysIn(d))
          else if (d.endsWith('-01')) { hit = true; note = 'sometime this month' }
        }
        if (!hit) continue
        const a = t.assignment ?? 'all'
        items.push({
          key: `t${t.id}-${d}`, kind: 'law', freq: t.frequency, time: t.time, title: t.title, minutes: t.minutes, law_id: t.law_id, note,
          band: a === 'opener' ? 'opener' : a === 'closer' ? 'closer' : 'daytime',
          role: a === 'opener' ? 'Opener' : a === 'closer' ? 'Closer' : a === 'managers' ? 'Joe' : null,
          who: a === 'opener' ? r?.opener ?? null : a === 'closer' ? r?.closer ?? null : a === 'managers' ? 'joe' : null,
        })
      }
      for (const o of oneoff.filter(x => x.d === d)) items.push({ key: `o${o.id}`, kind: 'oneoff', freq: 'once', time: null, title: o.title, minutes: null, law_id: null, note: o.notes, band: 'oneoff', role: null, who: o.assigned_to ? o.assigned_to.toLowerCase() : null })
      items.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
      out.push({ date: d, rota: r ? { opener: r.opener, closer: r.closer } : null, items })
    }
    return success({ from, to, days: out, canAdd: manager, people: ACTIVE_STAFF })
  } catch (e) { return handleError('todo GET', e) }
}

// POST { title, date, who?, notes? } -- add a to-do item for a future date (the owner and Joe). It rests on the "to-do items" law and
// shows on its date, in the assignee's To do and on their profile's Tasks tab.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and Joe add to-do items.')
  try {
    const b = await req.json().catch(() => ({}))
    const title = String(b.title ?? '').trim().slice(0, 200)
    const date = String(b.date ?? '')
    const who = String(b.who ?? '').toLowerCase()
    if (!title) return badRequest('Say what has to be done.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < dayKey()) return badRequest('Pick today or a future date.')
    if (who && !ACTIVE_STAFF.includes(who)) return badRequest('Pick a team member, or leave it for everyone.')
    await ensureCompanyLaws()
    const [law] = await sql`SELECT id FROM page_laws WHERE seed = 'todo-rota-v1' AND title = ${ONE_OFF_LAW} ORDER BY id LIMIT 1`
    await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS law_id INTEGER`.catch(() => {})
    await sql`ALTER TABLE custom_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT`.catch(() => {})
    const [row] = await sql`INSERT INTO custom_tasks (title, notes, due_date, submenu, view, law_id, assigned_to, task_type, created_by)
      VALUES (${title}, ${String(b.notes ?? '').trim().slice(0, 500) || null}, ${date}, 'To do', null, ${law?.id ?? null}, ${who || null}, 'To do', ${actorKey(session.user as never)})
      RETURNING id`
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('todo POST', e) }
}
