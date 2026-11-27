import { requireAuth, success, handleError } from '@/lib/api'
import { lossDays } from '@/lib/lossDays'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

// The items that lost the most money over a period (?period=30 | year | all), biggest first: times short, quantity, total ₵ and the latest loss. Open to every signed-in person.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error
  try {
    const p = req.nextUrl.searchParams.get('period') ?? '30'
    const today = new Date().toISOString().slice(0, 10)
    const from = p === 'all' ? '0000-00-00' : p === 'year' ? `${today.slice(0, 4)}-01-01` : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const agg = new Map<number, { item_id: number; name: string; times: number; qty: number; amt: number; last: string }>()
    for (const [d, list] of Object.entries(await lossDays())) {
      if (d < from) continue
      for (const r of list) {
        const a = agg.get(r.item_id) ?? { item_id: r.item_id, name: r.name, times: 0, qty: 0, amt: 0, last: '' }
        a.times += 1; a.qty += r.loss_qty; a.amt += r.loss_amt; if (d > a.last) a.last = d
        agg.set(r.item_id, a)
      }
    }
    const rows = [...agg.values()].sort((a, b) => b.amt - a.amt)
    return success({ period: p, total: rows.reduce((s, r) => s + r.amt, 0), count: rows.length, rows: rows.slice(0, 15) })
  } catch (e) { return handleError('losses ranking', e) }
}
