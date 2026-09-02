import { ensureCountRevisions } from '@/lib/countRevisions'
import { getItemDayRows } from '@/lib/itemDayRows'
import { NextResponse } from 'next/server'

// Keyed per item -- this is the heaviest single query pg_stat_statements
// showed in production (a multi-CTE day-by-day reconciliation with several
// LATERAL joins), and it was being re-run in full on every item detail view
// with no caching at all. 2 hours matches the other read-only summary
// endpoints' cache window.
const cache = new Map<number, { data: unknown; time: number }>()
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const id = Number(itemId)

  const cached = cache.get(id)
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  // The main query joins stock_count_revisions, which is created lazily.
  await ensureCountRevisions()

  const rows = await getItemDayRows(id)
  cache.set(id, { data: rows, time: Date.now() })

  return NextResponse.json(rows)
}
