import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { canLogAgainst } from '@/lib/violationLog'
import { SIGNERS } from '@/lib/signers'
import { parseTimeMins } from '@/lib/staffTimes'
import { ensureAttendance, lastActivity, firstActivityMins, setClockOut, to12h, hhmmTo12h, REVIEW_FROM } from '@/lib/attendance'
import { pushToUsers } from '@/lib/checklistAlerts'
import { cap } from '@/lib/strings'
import { NextRequest } from 'next/server'

// A supervisor clocks a staff member out when they have evidence the person is not at the shop (CCTV, a call, a photo...). Who: the owner and Joe for anyone,
// Bino for James (the same rights as logging a violation). If the supervisor knows when the person left they enter it; if not, the app uses the person's last
// shop-only action. The staff member is then told what was done and can tap OK or send a correction claim, which someone OTHER than the supervisor approves.
async function openRecord(staff: string) {
  const rows = await sql`SELECT work_date::text AS d, actual_in FROM staff_times WHERE LOWER(staff_name) = ${staff} AND actual_in IS NOT NULL AND actual_out IS NULL
    AND staff_name <> '__shop_open__' AND work_date >= ${REVIEW_FROM} ORDER BY work_date DESC LIMIT 1` as unknown as { d: string; actual_in: string }[]
  return rows[0] ?? null
}

// GET ?staff= -- can I clock this person out, and what would the app use if I do not know the time?
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureAttendance()
    const staff = String(req.nextUrl.searchParams.get('staff') ?? '').toLowerCase()
    if (!SIGNERS.includes(staff) || staff === 'grony' || !canLogAgainst(session.user as never, staff)) return success({ can: false })
    const rec = await openRecord(staff)
    if (!rec) {
      // Not clocked in: a supervisor can clock them IN today (evidence they are at the shop).
      const day = new Date().toISOString().slice(0, 10)
      const [t] = await sql`SELECT actual_in FROM staff_times WHERE LOWER(staff_name) = ${staff} AND work_date = ${day} AND actual_in IS NOT NULL`
      if (t) return success({ can: true, open: false })
      const f = await firstActivityMins(staff, day)
      return success({ can: true, open: false, canIn: true, date: day, firstActivity: f == null ? null : to12h(f) })
    }
    const inM = parseTimeMins(rec.actual_in)!
    const a = await lastActivity(staff, rec.d, inM)
    return success({ can: true, open: true, date: rec.d, in: rec.actual_in, lastActivity: a.found ? to12h(a.mins) : null })
  } catch (e) { return handleError('supervisor-out GET', e) }
}

// POST { staff, evidence, time? ('HH:MM') }
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    await ensureAttendance()
    const b = await req.json().catch(() => ({}))
    const staff = String(b.staff ?? '').toLowerCase(), me = actorKey(session.user as never)
    if (!SIGNERS.includes(staff) || staff === 'grony' || staff === me || !canLogAgainst(session.user as never, staff)) return badRequest('You cannot clock this person out.')
    const evidence = String(b.evidence ?? '').trim().slice(0, 300)
    if (evidence.length < 4) return badRequest('Write your evidence that they are not at the shop (for example "CCTV: left at 3:10pm", "called, they are at home").')
    const rec = await openRecord(staff)
    if (!rec) return badRequest('That person is not clocked in.')
    const inM = parseTimeMins(rec.actual_in)!
    let out: string, source: string, how: string
    if (b.time) {
      const m = String(b.time).match(/^(\d{1,2}):(\d{2})$/)
      if (!m) return badRequest('Enter the time they left.')
      const mins = Number(m[1]) * 60 + Number(m[2])
      if (mins <= inM) return badRequest('The time they left must be after their clock-in.')
      out = hhmmTo12h(String(b.time)); source = 'supervisor'; how = `the time ${cap(me)} entered`
    } else {
      const a = await lastActivity(staff, rec.d, inM)
      if (!a.found) return badRequest('There is no shop activity to base a time on. Enter the time they left.')
      out = to12h(a.mins); source = 'supervisor-auto'; how = 'their last action at the shop in the app'
    }
    await setClockOut(staff, rec.d, out, source, me)
    const basis = `${cap(me)} clocked you out at ${out} (${how}). Evidence: ${evidence}`
    await sql`INSERT INTO clock_autos (staff, work_date, out_time, basis, by_user) VALUES (${staff}, ${rec.d}, ${out}, ${basis}, ${me})
      ON CONFLICT (staff, work_date) DO UPDATE SET out_time = ${out}, basis = ${basis}, by_user = ${me}, status = 'notified'`
    void pushToUsers([staff], `${cap(me)} clocked you out`, `${rec.d}: out at ${out}. Evidence: ${evidence}. Open the app: tap OK, or send your correct time.`)
    if (me !== 'grony') void pushToUsers(['grony'], `${cap(me)} clocked ${cap(staff)} out`, `${rec.d}: ${out}. Evidence: ${evidence}`)
    return success({ ok: true, out, date: rec.d })
  } catch (e) { return handleError('supervisor-out POST', e) }
}
