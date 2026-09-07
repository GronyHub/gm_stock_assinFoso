import sql from '@/lib/db'
import { itemCountIntervalLabels } from '@/lib/countRules'
import { NextResponse } from 'next/server'
import { getCached } from '@/lib/cacheStore'

// Today's counting progress across the whole countable catalogue, for the
// "Count(2/2000)" summary above the Live Sale tab switcher. total = every
// item that's actually expected to be counted at some point (excludes
// 'excluded' items and currently-'dormant' ones, since neither is really
// "to do"); doneToday = how many of those already have a count logged today.
//
// This is the "badge" number the Help Guide already tells staff can lag --
// the actual COUNT NOW work list they act on is separate and always
// up to date -- so a short cache here costs nothing users would notice,
// while cutting the query every open Item hub tab fires every 10 minutes.
export async function GET() {
  const data = await getCached('stock:count-progress', 300, async () => {
    const labels = await itemCountIntervalLabels()
    const countableIds = [...labels.entries()]
      .filter(([, label]) => label !== 'excluded' && label !== 'dormant')
      .map(([id]) => id)

    if (countableIds.length === 0) return { total: 0, doneToday: 0 }

    const rows = await sql`
      SELECT COUNT(DISTINCT item_id) AS n
      FROM stock_counts
      WHERE count_date::date = CURRENT_DATE AND item_id = ANY(${countableIds})
    `
    const doneToday = Number((rows[0] as { n: string | number } | undefined)?.n ?? 0)
    return { total: countableIds.length, doneToday }
  })
  return NextResponse.json(data)
}
