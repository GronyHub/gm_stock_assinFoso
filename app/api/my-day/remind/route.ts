import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { myDay, viewablePeople } from '@/lib/myDay'
import { pushToUsers } from '@/lib/checklistAlerts'
import { NextRequest } from 'next/server'

// POST { name } -- a supervisor sends a staff member a reminder that things are waiting for them.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const user = session.user as { username?: string | null; name?: string | null; role?: string | null }
    const name = String((await req.json().catch(() => ({}))).name ?? '').toLowerCase()
    if (!name || !viewablePeople(user).includes(name)) return badRequest('You cannot remind that person.')
    const items = await myDay(name, user, { viewing: true })
    const total = items.filter(i => i.urgency !== 'later').reduce((n, i) => n + i.count, 0)
    if (!total) return success({ sent: false, message: 'Nothing urgent is waiting for them.' })
    const from = String(user?.username ?? user?.name ?? '')
    await pushToUsers([name], `${total} thing${total === 1 ? '' : 's'} waiting for you`, `${from.charAt(0).toUpperCase() + from.slice(1)} reminded you. Open Waiting for me to see them.`)
    return success({ sent: true, message: 'Reminder sent.' })
  } catch (e) { return handleError('my-day remind', e) }
}
