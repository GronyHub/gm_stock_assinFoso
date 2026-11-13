import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { actorKey } from '@/lib/clockState'
import { myDay } from '@/lib/myDay'
import { ensurePenalties, getSettings } from '@/lib/penalties'
import { addDays, dayKey } from '@/lib/dailyChecksShared'

// The short messages shown on screen (one after another, then gone) each time someone logs in. Reminders only: nothing here is pushed to a phone.
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const user = session.user as { username?: string | null; name?: string | null; role?: string | null }
    const me = actorKey(user as never)
    await ensurePenalties()
    const st = await getSettings(), today = dayKey()
    const out: { key: string; tone: 'red' | 'amber' | 'blue'; title: string; text: string }[] = []
    const pilot = today < st.startCounting
    if (pilot) out.push({ key: 'pilot', tone: 'blue', title: 'Penalty points: PILOT', text: `This is a pilot. Points you get now are practice and reset; they start counting on ${st.startCounting}.` })
    const pens = await sql`SELECT id, points, reason, day FROM staff_penalties WHERE staff = ${me} AND status = 'active' AND day >= ${addDays(today, -2)} ORDER BY day DESC, id DESC LIMIT 5` as unknown as { id: number; points: number; reason: string; day: string }[]
    for (const p of pens) out.push({ key: `pen${p.id}`, tone: 'red', title: `${p.points} penalty point${p.points === 1 ? '' : 's'}${pilot ? ' (pilot)' : ''} · ${p.day === today ? 'today' : p.day}`, text: p.reason })
    const items = await myDay(me, user, {}).catch(() => [])
    const late = items.filter(i => i.urgency === 'now' && i.state == null).reduce((a, i) => a + (i.count || 1), 0)
    if (late > 0) out.push({ key: 'waiting', tone: 'amber', title: 'Waiting for you', text: `${late} thing${late === 1 ? ' is' : 's are'} due now in Waiting for me.` })
    if ((user as { role?: string }).role === 'owner') {
      // Joe decides Bino's and James's clock times; after 48 hours unanswered the owner is told (on screen, never pushed).
      const [od] = await sql`SELECT COUNT(*)::int AS n FROM clock_corrections WHERE status = 'pending' AND staff <> 'joe' AND requested_at < now() - interval '48 hours'`.catch(() => [{ n: 0 }])
      if (Number(od?.n ?? 0) > 0) out.unshift({ key: 'clock-overdue', tone: 'red', title: 'Joe has not decided', text: `${od.n} staff clock time${od.n === 1 ? ' has' : 's have'} waited over 2 days for Joe. Open Shop > Times > the clock icon: you can approve them yourself.` })
    }
    out.push({ key: 'late-rule', tone: 'blue', title: 'Late or absent?', text: 'Tell the shop in the app first (Times > report). Late without telling = 1 point; absent without notice = 2 points.' })
    return success({ reminders: out })
  } catch (e) { return handleError('login reminders', e) }
}
