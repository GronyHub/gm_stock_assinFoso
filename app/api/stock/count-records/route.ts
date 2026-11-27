import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import { countRecords } from '@/lib/countRecords'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// ?item=ID: that item's counts (open to every signed-in person). ?date=YYYY-MM-DD: that day's counts, and ?days=1: how many counts each day had (both for the owner and Joe, like the Sales Log's money lines).
export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const role = (session?.user as { role?: string } | undefined)?.role
  try {
    const all = await countRecords()
    const q = req.nextUrl.searchParams
    const item = Number(q.get('item'))
    if (item > 0) return success({ item, rows: all.filter(r => r.item_id === item) })
    if (role === 'staff') return badRequest('Forbidden')
    const date = q.get('date')
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return success({ date, rows: all.filter(r => r.date === date) })
    if (q.get('days')) { const m: Record<string, number> = {}; for (const r of all) m[r.date] = (m[r.date] ?? 0) + 1; return success(m) }
    return badRequest('Which item or day?')
  } catch (e) { return handleError('count-records', e) }
}
