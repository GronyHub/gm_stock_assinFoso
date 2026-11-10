import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { parseTimeMins } from '@/lib/staffTimes'
import { ensureAttendance, openRecords, lastActivityMins, setClockOut, to12h, hhmmTo12h, CLOSING_MINS } from '@/lib/attendance'
import { notifyOwners, pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

const today = () => new Date().toISOString().slice(0, 10)
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

// GET -- do I owe an answer? { askNow } after 19:00 while I am still clocked in and have not answered; { previous } earlier days I never clocked out of.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureAttendance()
    const me = actorKey(user as any)
    if (!SIGNERS.includes(me)) return success({ askNow: false, previous: [] })
    const day = today(), now = new Date()
    const open = await openRecords(me)
    const todays = open.find(r => r.d === day)
    const [ans] = await sql`SELECT answer FROM clock_prompts WHERE day = ${day} AND staff = ${me}`
    const askNow = !!todays && now.getUTCHours() * 60 + now.getUTCMinutes() >= CLOSING_MINS && !ans
    return success({ askNow, previous: open.filter(r => r.d < day).map(r => ({ date: r.d, in: r.actual_in })) })
  } catch (e) { return handleError('clock open-check GET', e) }
}

// POST { action: 'still_here' } | { action: 'left' } | { action: 'enter', date?, time: 'HH:MM' }
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureAttendance()
    const me = actorKey(user as any)
    if (!SIGNERS.includes(me)) return badRequest('Not on the staff list.')
    const b = await req.json().catch(() => ({}))
    const day = today()
    if (b.action === 'still_here') { await sql`INSERT INTO clock_prompts (day, staff, answer) VALUES (${day}, ${me}, 'still_here') ON CONFLICT DO NOTHING`; return success({ ok: true }) }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date ?? '')) ? String(b.date) : day
    const [rec] = await sql`SELECT actual_in, actual_out FROM staff_times WHERE LOWER(staff_name) = ${me} AND work_date = ${date} AND actual_in IS NOT NULL`
    const inMins = parseTimeMins(rec?.actual_in ?? null)
    if (!rec || inMins == null) return badRequest('There is no clock-in for that day.')

    if (b.action === 'left') {
      if (rec.actual_out) return badRequest('You are already clocked out.')
      const mins = await lastActivityMins(me, date, inMins)
      const out = to12h(mins)
      await setClockOut(me, date, out, 'estimated', 'system')
      await sql`INSERT INTO clock_prompts (day, staff, answer) VALUES (${date === day ? day : date}, ${me}, 'left') ON CONFLICT DO NOTHING`
      return success({ out, basis: 'your last activity in the app' })
    }

    if (b.action === 'enter') {
      const m = String(b.time ?? '').match(/^(\d{1,2}):(\d{2})$/)
      if (!m) return badRequest('Enter the time you left.')
      const mins = Number(m[1]) * 60 + Number(m[2])
      if (mins <= inMins) return badRequest('Your time out must be after your clock-in.')
      if (mins > 23 * 60 + 59) return badRequest('That is not a valid time.')
      const t12 = hhmmTo12h(String(b.time))
      if (me === 'grony') { await setClockOut(me, date, t12, 'manual', me); return success({ out: t12, approved: true }) }
      // Until an owner approves, the app's own last-activity time stands in, so the day is never left open.
      if (!rec.actual_out) await setClockOut(me, date, to12h(await lastActivityMins(me, date, inMins)), 'estimated', 'system')
      await sql`UPDATE clock_corrections SET status = 'rejected', note = 'Replaced by a newer entry' WHERE staff = ${me} AND work_date = ${date} AND status = 'pending'`
      await sql`INSERT INTO clock_corrections (staff, work_date, kind, proposed_out, basis) VALUES (${me}, ${date}, 'entered', ${t12}, ${'Entered by ' + cap(me)})`
      // Joe's own times are approved by Grony only; everyone else's by Grony or Joe.
      if (me === 'joe') void pushToUsers(['grony'], 'Joe sent a clock-out time to approve', `${date}: ${t12}. Open the Daily Checklist to approve it.`)
      else void notifyOwners(`${cap(me)} sent a clock-out time to approve`, `${date}: ${t12}. Open the Daily Checklist to approve it.`)
      return success({ out: t12, pending: true })
    }
    return badRequest('Unknown action.')
  } catch (e) { return handleError('clock open-check POST', e) }
}
