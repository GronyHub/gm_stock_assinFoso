import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'

// Backs Sale mode's 3 read-only "least sales" charts (Services/Goods/
// Groups). One query computes everything needed for all three (all-time qty
// sold per item, same UNION pattern as /api/analysis/summary's
// topItemsBySales, plus current SOH and staleness dates), then each chart's
// list is sliced/grouped from it in JS -- cheaper than three separate round
// trips for numbers that mostly come from the same underlying rows.
const LIMIT = 15

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    const data = await getCached('analysis:least-sales', 7200, async () => {
      const rows = await sql`
        WITH sold AS (
          SELECT item_id, SUM(qty) AS qty, MAX(d) AS last_sale_date
          FROM (
            SELECT srl.item_id, srl.quantity AS qty, srl.receipt_date::date AS d
            FROM sales_receipt_lines srl
            WHERE srl.item_id IS NOT NULL
            UNION ALL
            SELECT lst.item_id, lst.quantity AS qty, lst.tapped_at::date AS d
            FROM live_sale_taps lst
            WHERE lst.undone = false AND lst.item_id IS NOT NULL
          ) combined
          GROUP BY item_id
        ),
        first_bill AS (
          SELECT bl.item_id, MIN(b.bill_date) AS first_bill_date
          FROM bill_lines bl
          JOIN bills b ON b.id = bl.bill_id
          WHERE bl.item_id IS NOT NULL
          GROUP BY bl.item_id
        )
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group", i.product_type,
          COALESCE(iss.calculated_soh, 0)::float AS soh,
          COALESCE(s.qty, 0)::float AS qty_sold,
          s.last_sale_date,
          fb.first_bill_date
        FROM items i
        LEFT JOIN item_stock_summary iss ON iss.item_id = i.id
        LEFT JOIN sold s ON s.item_id = i.id
        LEFT JOIN first_bill fb ON fb.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
      ` as {
        id: number; name: string; group: string | null; product_type: string | null
        soh: number; qty_sold: number; last_sale_date: string | null; first_bill_date: string | null
      }[]

      const byQtyAsc = (a: { qty_sold: number; name: string }, b: { qty_sold: number; name: string }) =>
        a.qty_sold - b.qty_sold || a.name.localeCompare(b.name)

      const services = rows
        .filter(r => r.product_type === 'service')
        .sort(byQtyAsc)
        .slice(0, LIMIT)
        .map(r => ({ id: r.id, name: r.name, qty_sold: r.qty_sold }))

      // Goods ranks by days since last sale (falling back to how long it's
      // sat on the shelf since it first arrived, for a good that's never
      // sold at all) rather than qty -- a good with zero SOH isn't sitting
      // unsold, it's just out of stock, so it's excluded rather than
      // (misleadingly) topping this list. A good with neither a sale nor a
      // bill on record has no date to measure staleness from, so it's
      // excluded too (rare -- e.g. opening stock set with no bill entered).
      const msPerDay = 1000 * 60 * 60 * 24
      const today = Date.now()
      const goods = rows
        .filter(r => r.product_type !== 'service' && r.soh > 0)
        .map(r => {
          const staleSince = r.last_sale_date ?? r.first_bill_date
          const days_unsold = staleSince ? Math.floor((today - new Date(staleSince).getTime()) / msPerDay) : null
          return { id: r.id, name: r.name, soh: r.soh, days_unsold }
        })
        .filter((r): r is { id: number; name: string; soh: number; days_unsold: number } => r.days_unsold !== null)
        .sort((a, b) => b.days_unsold - a.days_unsold || a.name.localeCompare(b.name))
        .slice(0, LIMIT)

      const groupTotals = new Map<string, number>()
      for (const r of rows) {
        const g = r.group || '(No Group)'
        groupTotals.set(g, (groupTotals.get(g) ?? 0) + r.qty_sold)
      }
      const groups = Array.from(groupTotals, ([name, qty_sold]) => ({ name, qty_sold }))
        .sort(byQtyAsc)
        .slice(0, LIMIT)

      return { services, goods, groups }
    })

    return success(data)
  } catch (e) {
    return handleError('analysis/least-sales', e)
  }
}
