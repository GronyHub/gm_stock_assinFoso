import sql from '@/lib/db'
import { addPoint, ensurePenalties } from '@/lib/penalties'

// THE DAILY COUNTS LAW (standalone, not a flag). Every working day the manager (Joe) makes sure at least COUNTS_PER_DAY items are counted (a stock count saved
// in Counts, by anyone). Each day fewer are counted costs the manager 1 penalty point, checked at 19:25.
export const COUNTS_PER_DAY = 10
const MANAGER = 'joe'

export async function countsToday(day: string): Promise<number> {
  const [r] = await sql`SELECT COUNT(DISTINCT item_id)::int AS n FROM stock_counts WHERE count_date = ${day}::date`.catch(() => [{ n: 0 }])
  return Number(r?.n ?? 0)
}
export const countsText = (n: number) => `${n} of ${COUNTS_PER_DAY} items counted today. Open Counts and count the items due.`

export async function assessCounts(day: string) {
  await ensurePenalties()
  const n = await countsToday(day)
  if (n >= COUNTS_PER_DAY) return
  await addPoint({ staff: MANAGER, points: 1, reason: `Only ${n} of ${COUNTS_PER_DAY} items counted on ${day} (the law: at least ${COUNTS_PER_DAY} counts a day)`, source: 'counts', ref: `counts:${day}`, day, by: 'system' })
}
