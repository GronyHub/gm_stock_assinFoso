import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { actorKey } from '@/lib/clockState'
import { recordActivity } from '@/lib/logger'
import { pushToUsers } from '@/lib/checklistAlerts'
import { addDays, dayKey } from '@/lib/dailyChecksShared'
import { ACTIVE_STAFF } from '@/lib/staffList'
import { ensureAbsenceColumns } from '@/lib/attendancePenalties'
import { NextRequest } from 'next/server'

const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// POST { type?: 'absent' | 'late', from, to?, expected?, reason?, staff? } -- a staff member reports their own absence, at least a day before it (so the rota and the Opener and Closer can be planned).
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
    const late = b.type === 'late'
    const from = String(b.from ?? ''), to = late ? from : String(b.to ?? '') || from
    const expected = late ? String(b.expected ?? '') : ''
    if (late && !/^[0-2][0-9]:[0-5][0-9]$/.test(expected)) return badRequest('Say the time you expect to arrive, for example 09:30.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return badRequest('Pick the first day, and a last day that is not before it.')
    if (addDays(from, 60) < to) return badRequest('Report up to 60 days at a time.')
    if (!ownerLevel && from < dayKey()) return badRequest('That day has passed. Ask Joe to record it.')
    const reason = String(b.reason ?? '').trim().slice(0, 200)
    await sql`CREATE TABLE IF NOT EXISTS staff_absences (id SERIAL PRIMARY KEY, staff_name TEXT NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL, reason TEXT, absence_type TEXT, entered_by TEXT)`.catch(() => {})
    await ensureAbsenceColumns()
    const [row] = await sql`INSERT INTO staff_absences (staff_name, start_date, end_date, reason, absence_type, entered_by, expected_time) VALUES (${cap(who)}, ${from}, ${to}, ${reason || null}, ${late ? 'late' : 'reported'}, ${me}, ${expected || null}) RETURNING id`
    const span = from === to ? from : `${from} to ${to}`
    void recordActivity(me, late ? 'reported being late' : 'reported an absence', `${cap(who)}: ${late ? `${from}, expected ${expected}` : span}${reason ? ` (${reason})` : ''}`)
    void pushToUsers(['grony', 'joe'].filter(n => n !== me), late ? `${cap(who)} will be late` : `${cap(who)} will be absent`, late ? `${from}, expected at ${expected}${reason ? `: ${reason}` : ''}.` : `${span}${reason ? `: ${reason}` : ''}. The rota and the Opener and Closer need cover.`)
    return success({ id: row.id }, 201)
  } catch (e) { return handleError('absence report', e) }
}
