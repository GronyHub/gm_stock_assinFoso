import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'

// Backs Sale mode's read-only "Goods: Longest Unbought" chart -- how many
// days since each good was last on a bill (a purchase from a vendor), not
// how long since it last sold (that's the separate Least Sales/idle-value
// chart). Zero-SOH goods are excluded, same as Least Sales.
const LIMIT = 15

type Tier = 'Critical' | 'High' | 'Watch'
function tierFor(index: number, total: number): Tier {
  const pct = total <= 1 ? 0 : index / (total - 1)
  return pct < 1 / 3 ? 'Critical' : pct < 2 / 3 ? 'High' : 'Watch'
}

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const data = await getCached('analysis:least-purchased', 7200, async () => {
      const rows = await sql`
        WITH last_bill AS (
          SELECT bl.item_id, MAX(b.bill_date) AS last_bill_date
          FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE bl.item_id IS NOT NULL
          GROUP BY bl.item_id
        ),
        first_activity AS (
          SELECT item_id, MIN(d) AS first_activity_date
          FROM (
            SELECT item_id, receipt_date::date AS d FROM sales_receipt_lines WHERE item_id IS NOT NULL
            UNION ALL
            SELECT item_id, tapped_at::date AS d FROM live_sale_taps WHERE item_id IS NOT NULL
            UNION ALL
            SELECT item_id, count_date::date AS d FROM stock_counts WHERE item_id IS NOT NULL
          ) combined
          GROUP BY item_id
        )
        SELECT i.id, i.canonical_name AS name,
          COALESCE(iss.calculated_soh, 0)::float AS soh,
          lb.last_bill_date,
          fa.first_activity_date
        FROM items i
        LEFT JOIN item_stock_summary iss ON iss.item_id = i.id
        LEFT JOIN last_bill lb ON lb.item_id = i.id
        LEFT JOIN first_activity fa ON fa.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
          AND COALESCE(i.product_type, 'goods') <> 'service'
      ` as { id: number; name: string; soh: number; last_bill_date: string | null; first_activity_date: string | null }[]

      const msPerDay = 1000 * 60 * 60 * 24
      const today = Date.now()

      // A good with no bill on record at all still gets a real, varying day
      // count here -- measured from the earliest sale/tap/count on record
      // for it instead (the longest we can prove it's existed without ever
      // being bought). Only a good with truly zero history of any kind
      // (never billed, never sold, never counted) has nothing to measure
      // from, and is left out rather than given a made-up number.
      const items = rows
        .filter(r => r.soh > 0)
        .map(r => {
          const neverBought = r.last_bill_date === null
          const staleSince = r.last_bill_date ?? r.first_activity_date
          const days_unbought = staleSince ? Math.floor((today - new Date(staleSince).getTime()) / msPerDay) : null
          return { id: r.id, name: r.name, soh: r.soh, days_unbought, neverBought }
        })
        .filter((r): r is { id: number; name: string; soh: number; days_unbought: number; neverBought: boolean } => r.days_unbought !== null)
        .sort((a, b) => b.days_unbought - a.days_unbought || a.name.localeCompare(b.name))
        .slice(0, LIMIT)
        .map((r, i, arr) => ({ ...r, tier: tierFor(i, arr.length) }))

      return { items }
    })

    return success(data)
  } catch (e) {
    return handleError('analysis/least-purchased', e)
  }
}
