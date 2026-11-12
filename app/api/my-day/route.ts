import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { myDay, personDay, teamNotDone, viewablePeople } from '@/lib/myDay'
import { NextRequest } from 'next/server'

// GET -- everything waiting for the signed-in person. ?count=1 returns only the totals (for the badge and the bar).
// ?people=1 lists whose list this person may look at; ?for=name returns that person's list (supervisors only, read-only).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const user = session.user as { username?: string | null; name?: string | null; role?: string | null }
    const q = req.nextUrl.searchParams
    if (q.get('team')) return success(await teamNotDone(user))
    if (q.get('people')) return success({ people: viewablePeople(user) })
    // ?counts=1: for a supervisor, how many things wait for each person they may look at (shown as a count on their avatar)
    if (q.get('counts')) {
      const out: Record<string, { total: number; now: number }> = {}
      for (const n of viewablePeople(user)) {
        const its = await myDay(n, user, { viewing: true })
        out[n] = { total: its.filter(i => i.urgency !== 'later').reduce((a, i) => a + i.count, 0), now: its.filter(i => i.urgency === 'now').reduce((a, i) => a + i.count, 0) }
      }
      return success({ counts: out })
    }
    const forName = (q.get('for') ?? '').toLowerCase()
    if (forName && !viewablePeople(user).includes(forName)) return badRequest('You cannot look at that list.')
    const lens = q.get('lens') === 'notdone' ? 'notdone' : q.get('lens') === 'todo' ? 'todo' : 'all'
    const date = q.get('date') ?? ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && date !== new Date().toISOString().slice(0, 10)) return success({ items: await personDay(forName || actorKey(user as never), date) })
    const items = await myDay(forName || actorKey(user as never), user, { viewing: !!forName, lens })
    if (q.get('count')) return success({ total: items.reduce((n, i) => n + (i.urgency === 'later' ? 0 : i.count), 0), now: items.filter(i => i.urgency === 'now').reduce((n, i) => n + i.count, 0) })
    return success({ items })
  } catch (e) { return handleError('my-day GET', e) }
}
