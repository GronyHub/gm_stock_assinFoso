import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'

// Backs Sale mode's read-only "Goods: Longest Unbought" chart -- how many
// days since each good was last on a bill (a purchase from a vendor), not
// how long since it last sold (that's the separate Least Sales/idle-value
// chart). Unlike that one, a good with 0 SOH is NOT excluded here -- zero
// stock plus a very long time since it was last bought is often exactly the
// case worth surfacing (restocking neglected), not a case to hide.
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
        )
        SELECT i.id, i.canonical_name AS name,
          COALESCE(iss.calculated_soh, 0)::float AS soh,
          lb.last_bill_date
        FROM items i
        LEFT JOIN item_stock_summary iss ON iss.item_id = i.id
        LEFT JOIN last_bill lb ON lb.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
          AND COALESCE(i.product_type, 'goods') <> 'service'
      ` as { id: number; name: string; soh: number; last_bill_date: string | null }[]

      const msPerDay = 1000 * 60 * 60 * 24
      const today = Date.now()

      // Never-bought goods (no bill on record at all) rank above every
      // specific day count -- there's no more extreme case than "not once".
      const items = rows
        .map(r => ({
          id: r.id, name: r.name, soh: r.soh,
          days_unbought: r.last_bill_date ? Math.floor((today - new Date(r.last_bill_date).getTime()) / msPerDay) : null,
        }))
        .sort((a, b) => {
          if (a.days_unbought === null && b.days_unbought === null) return a.name.localeCompare(b.name)
          if (a.days_unbought === null) return -1
          if (b.days_unbought === null) return 1
          return b.days_unbought - a.days_unbought || a.name.localeCompare(b.name)
        })
        .slice(0, LIMIT)
        .map((r, i, arr) => ({ ...r, tier: tierFor(i, arr.length) }))

      return { items }
    })

    return success(data)
  } catch (e) {
    return handleError('analysis/least-purchased', e)
  }
}
