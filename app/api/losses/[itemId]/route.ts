import { ensureCountRevisions } from '@/lib/countRevisions'
import { getItemDayRows } from '@/lib/itemDayRows'
import { getCached } from '@/lib/cacheStore'
import { NextResponse } from 'next/server'

// Keyed per item -- this is the heaviest single query pg_stat_statements
// showed in production (a multi-CTE day-by-day reconciliation with several
// LATERAL joins), and it was being re-run in full on every item detail view
// with no caching at all. 2 hours matches the other read-only summary
// endpoints' cache window. Uses the shared cacheStore (not a private Map)
// so a count write (see /api/stock/count and /api/stock/counts/[id]) can
// invalidate this exact item's entry instead of staff waiting up to 2 hours
// to see their own edit reflected in Item 360's own day table.
const CACHE_TTL_SECONDS = 2 * 60 * 60

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const id = Number(itemId)

  // The main query joins stock_count_revisions, which is created lazily.
  await ensureCountRevisions()

  const rows = await getCached(`losses:${id}`, CACHE_TTL_SECONDS, () => getItemDayRows(id))

  return NextResponse.json(rows)
}
