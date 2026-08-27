import sql from '@/lib/db'
import { itemCountIntervalLabels } from '@/lib/countRules'
import { NextResponse } from 'next/server'

// Today's counting progress across the whole countable catalogue, for the
// "Count(2/2000)" summary above the Live Sale tab switcher. total = every
// item that's actually expected to be counted at some point (excludes
// 'excluded' items and currently-'dormant' ones, since neither is really
// "to do"); doneToday = how many of those already have a count logged today.
export async function GET() {
  const labels = await itemCountIntervalLabels()
  const countableIds = [...labels.entries()]
    .filter(([, label]) => label !== 'excluded' && label !== 'dormant')
    .map(([id]) => id)

  if (countableIds.length === 0) return NextResponse.json({ total: 0, doneToday: 0 })

  const rows = await sql`
    SELECT COUNT(DISTINCT item_id) AS n
    FROM stock_counts
    WHERE count_date::date = CURRENT_DATE AND item_id = ANY(${countableIds})
  `
  const doneToday = Number((rows[0] as { n: string | number } | undefined)?.n ?? 0)
  return NextResponse.json({ total: countableIds.length, doneToday })
}
