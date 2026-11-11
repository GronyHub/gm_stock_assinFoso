import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { pushToUsers } from '@/lib/checklistAlerts'
import { addDays, dayKey } from '@/lib/dailyChecksShared'
import { ACTIVE_STAFF } from '@/lib/staffList'
import { NextRequest } from 'next/server'

const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// POST { from, to?, reason?, staff? } -- a staff member reports their own absence, at least a day before it (so the rota and the Opener and Closer can be planned).
// The owner and Joe can record an absence for anyone, on any date (for something that happens on the day).
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const b = await req.json().catch(() => ({}))
    const me = actorKey(session.user as never)
    const ownerLevel = isOwnerLevel(session.user as never)
    const who = ownerLevel && b.staff ? String(b.staff).toLowerCase() : me
    if (!ACTIVE_STAFF.includes(who) || who === 'grony') return badRequest('Absences are reported for the team members on the rota.')
    const from = String(b.from ?? ''), to = String(b.to ?? '') || from
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return badRequest('Pick the first day, and a last day that is not before it.')
    if (addDays(from, 60) < to) return badRequest('Report up to 60 days at a time.')
    if (!ownerLevel && from < addDays(dayKey(), 1)) return badRequest('An absence must be reported at least a day before. For today, tell Joe straight away.')
    const reason = String(b.reason ?? '').trim().slice(0, 200)
    await sql`CREATE TABLE IF NOT EXISTS staff_absences (id SERIAL PRIMARY KEY, staff_name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, reason TEXT, absence_type TEXT, entered_by TEXT)`.catch(() => {})
    const [row] = await sql`INSERT INTO staff_absences (staff_name, start_date, end_date, reason, absence_type, entered_by) VALUES (${cap(who)}, ${from}, ${to}, ${reason || null}, 'reported', ${me}) RETURNING id`
    const span = from === to ? from : `${from} to ${to}`
    void recordActivity(me, 'reported an absence', `${cap(who)}: ${span}${reason ? ` (${reason})` : ''}`)
    void pushToUsers(['grony', 'joe'].filter(n => n !== me), `${cap(who)} will be absent`, `${span}${reason ? `: ${reason}` : ''}. The rota and the Opener and Closer need cover.`)
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('absence report', e) }
}
