import { requireAuth, success, handleError } from '@/lib/api'
import { actorKey } from '@/lib/clockState'
import { myDay } from '@/lib/myDay'
import { NextRequest } from 'next/server'

// GET -- everything waiting for the signed-in person. ?count=1 returns only the totals (for the sidebar badge).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  try {
    const items = await myDay(actorKey(session.user as never), session.user)
    if (req.nextUrl.searchParams.get('count')) return success({ total: items.reduce((n, i) => n + (i.urgency === 'later' ? 0 : i.count), 0), now: items.filter(i => i.urgency === 'now').length })
    return success({ items })
  } catch (e) { return handleError('my-day GET', e) }
}
