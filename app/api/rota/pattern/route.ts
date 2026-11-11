import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { addDays, WEEKDAYS } from '@/lib/dailyChecksShared'
import { NextRequest } from 'next/server'

const ON_ROTA = ['joe', 'bino', 'james']
const HM = /^([01]\d|2[0-3]):[0-5]\d$/
const to12 = (hm: string) => { const h = Number(hm.slice(0, 2)), m = hm.slice(3); return `${((h + 11) % 12) + 1}:${m}${h >= 12 ? 'pm' : 'am'}` }
const mins = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3))
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)

type Shift = { in: string; out: string } | null
// POST { from, to, week: { name: { mon: {in,out}|null, ... sun } } } -- fill the rota for a date range from a standard week (owner and Joe).
// Every person's days in the range are written (a day without a shift is an off day); the earliest start of each day becomes its "opener"
// and the latest finish its "closer", which is how the rota names the Opener and Closer. Existing entries for those people and dates are replaced.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session.user as never)) return badRequest('Only the owner and Joe can set the rota.')
  try {
    const b = await req.json().catch(() => ({}))
    const from = String(b.from ?? ''), to = String(b.to ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return badRequest('Pick a start date and an end date after it.')
    if (addDays(from, 366) < to) return badRequest('Fill at most a year at a time.')
    const week = (b.week ?? {}) as Record<string, Record<string, Shift>>
    const people = Object.keys(week).map(n => n.toLowerCase()).filter(n => ON_ROTA.includes(n))
    if (!people.length) return badRequest('No one to put on the rota.')
    for (const n of people) for (const d of WEEKDAYS) { const s = week[n]?.[d]; if (s && (!HM.test(s.in) || !HM.test(s.out) || mins(s.out) <= mins(s.in))) return badRequest(`${cap(n)}'s ${d}: the finish must be after the start.`) }
    let written = 0
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dow = WEEKDAYS[new Date(d + 'T00:00:00Z').getUTCDay()]
      const todays = people.map(n => ({ n, s: (week[n]?.[dow] ?? null) as Shift })).filter(x => x.s)
      const first = [...todays].sort((a, c) => mins(a.s!.in) - mins(c.s!.in))[0]?.n
      const last = [...todays].sort((a, c) => mins(c.s!.out) - mins(a.s!.out))[0]?.n
      for (const n of people) {
        const s = (week[n]?.[dow] ?? null) as Shift
        const role = !s ? null : n === first ? 'opener' : n === last ? 'closer' : 'normal'
        await sql`INSERT INTO staff_rota (staff_name, rota_date, sched_in, sched_out, is_off, role)
          VALUES (${cap(n)}, ${d}, ${s ? to12(s.in) : null}, ${s ? to12(s.out) : null}, ${!s}, ${role})
          ON CONFLICT (staff_name, rota_date) DO UPDATE SET sched_in = EXCLUDED.sched_in, sched_out = EXCLUDED.sched_out, is_off = EXCLUDED.is_off, role = EXCLUDED.role`
        written++
      }
    }
    return success({ written, days: Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1 })
  } catch (e) { return handleError('rota pattern POST', e) }
}
