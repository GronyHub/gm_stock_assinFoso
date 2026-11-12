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

// GET -- who may add a to-do and who it can be given to. What each date holds is read from /api/duties (the one calculation behind Waiting for team and Waiting for me).
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    return success({ canAdd: isOwnerLevel(session.user as never), people: ACTIVE_STAFF })
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
