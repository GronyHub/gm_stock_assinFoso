import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { lossDays } from '@/lib/lossDays'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// The items behind a day's Daily Loss (the figure on the Sales Log day line and in Profit & Loss), or one item's whole loss history (?item=ID), with who counted, when, the source and the reason.
// One day at a time (?date=YYYY-MM-DD) so the answer stays small. The item's own history is open to every signed-in person; the day lists and the whole history are for the owner and Joe (like the P&L).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const role = (session?.user as { role?: string } | undefined)?.role
  try {
    const out = await lossDays()
    const itemId = Number(req.nextUrl.searchParams.get('item'))
    if (itemId > 0) {
      const rows = Object.entries(out).flatMap(([d, list]) => list.filter(r => r.item_id === itemId).map(r => ({ date: d, ...r }))).sort((x, y) => y.date.localeCompare(x.date))
      return success({ item: itemId, rows })
    }
    if (role === 'staff') return badRequest('Forbidden')
    const date = req.nextUrl.searchParams.get('date')
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return success({ date, rows: out[date] ?? [] })
    return success(out)
  } catch (e) { return handleError('losses by-day', e) }
}
