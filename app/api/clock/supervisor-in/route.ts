import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { canLogAgainst } from '@/lib/violationLog'
import { SIGNERS } from '@/lib/signers'
import { ensureAttendance, firstActivityMins, to12h, hhmmTo12h } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { cap } from '@/lib/strings'
import { NextRequest } from 'next/server'

// Same as clocking someone out for them, but for clock-in: a supervisor clocks in a staff member who is at the shop but has not clocked in, with the evidence
// (CCTV, seen at the counter...). If the supervisor does not know when they arrived, the app uses the person's FIRST shop-only action today.
// The person is told and can tap OK or send a correction claim, decided by someone other than the supervisor.
// POST { staff, evidence, time? ('HH:MM') }
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureAttendance()
    const b = await req.json().catch(() => ({}))
    const staff = String(b.staff ?? '').toLowerCase(), me = actorKey(session.user as never)
    if (!SIGNERS.includes(staff) || staff === 'grony' || staff === me || !canLogAgainst(session.user as never, staff)) return badRequest('You cannot clock this person in.')
    const evidence = String(b.evidence ?? '').trim().slice(0, 300)
    if (evidence.length < 4) return badRequest('Write your evidence that they are at the shop (for example "CCTV: arrived 8:05am", "I saw them at the counter").')
    const day = new Date().toISOString().slice(0, 10)
    const [ex] = await sql`SELECT actual_in FROM staff_times WHERE LOWER(staff_name) = ${staff} AND work_date = ${day}`
    if (ex?.actual_in) return badRequest('That person is already clocked in today.')
    let t12: string, how: string
    if (b.time) {
      if (!/^\d{1,2}:\d{2}$/.test(String(b.time))) return badRequest('Enter the time they arrived.')
      t12 = hhmmTo12h(String(b.time)); how = `the time ${cap(me)} entered`
    } else {
      const f = await firstActivityMins(staff, day)
      if (f == null) return badRequest('There is no shop activity to base a time on. Enter the time they arrived.')
      t12 = to12h(f); how = 'their first action at the shop in the app'
    }
    if (ex) await sql`UPDATE staff_times SET actual_in = ${t12}, in_source = 'supervisor', entered_by = ${me} WHERE LOWER(staff_name) = ${staff} AND work_date = ${day}`
    else await sql`INSERT INTO staff_times (staff_name, work_date, actual_in, in_source, entered_by) VALUES (${staff}, ${day}, ${t12}, 'supervisor', ${me})`
    const basis = `${cap(me)} clocked you in at ${t12} (${how}). Evidence: ${evidence}`
    await sql`INSERT INTO clock_in_autos (staff, work_date, in_time, basis, by_user) VALUES (${staff}, ${day}, ${t12}, ${basis}, ${me})
      ON CONFLICT (staff, work_date) DO UPDATE SET in_time = ${t12}, basis = ${basis}, by_user = ${me}, status = 'notified'`
    void pushToUsers([staff], `${cap(me)} clocked you in`, `${day}: in at ${t12}. Evidence: ${evidence}. Open the app: tap OK, or send your correct time.`)
    if (me !== 'grony') void pushToUsers(['grony'], `${cap(me)} clocked ${cap(staff)} in`, `${day}: ${t12}. Evidence: ${evidence}`)
    return success({ ok: true, in: t12, date: day })
  } catch (e) { return handleError('supervisor-in POST', e) }
}
