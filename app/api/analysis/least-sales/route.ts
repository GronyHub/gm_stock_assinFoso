import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'
import { ensureAdjustedCostPriceColumn } from '@/lib/vcpSync'

// Backs Sale mode's 3 read-only "least sales" charts (Services/Goods/
// Groups). One query computes everything needed for all three (all-time qty
// sold per item, same UNION pattern as /api/analysis/summary's
// topItemsBySales, plus current SOH and cost), then each chart's list is
// sliced/grouped from it in JS -- cheaper than three separate round trips
// for numbers that mostly come from the same underlying rows.
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
    await ensureAdjustedCostPriceColumn()

    const data = await getCached('analysis:least-sales', 7200, async () => {
      const rows = await sql`
        WITH sold AS (
          SELECT item_id, SUM(qty) AS qty
          FROM (
            SELECT srl.item_id, srl.quantity AS qty
            FROM sales_receipt_lines srl
            WHERE srl.item_id IS NOT NULL
            UNION ALL
            SELECT lst.item_id, lst.quantity AS qty
            FROM live_sale_taps lst
            WHERE lst.undone = false AND lst.item_id IS NOT NULL
          ) combined
          GROUP BY item_id
        )
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group", i.product_type,
          COALESCE(iss.calculated_soh, 0)::float AS soh,
          COALESCE(i.adjusted_cost_price, i.purchase_rate, 0)::float AS unit_cost,
          COALESCE(s.qty, 0)::float AS qty_sold
        FROM items i
        LEFT JOIN item_stock_summary iss ON iss.item_id = i.id
        LEFT JOIN sold s ON s.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
      ` as { id: number; name: string; group: string | null; product_type: string | null; soh: number; unit_cost: number; qty_sold: number }[]

      const byQtyAsc = (a: { qty_sold: number; name: string }, b: { qty_sold: number; name: string }) =>
        a.qty_sold - b.qty_sold || a.name.localeCompare(b.name)

      const services = rows
        .filter(r => r.product_type === 'service')
        .sort(byQtyAsc)
        .slice(0, LIMIT)
        .map(r => ({ id: r.id, name: r.name, qty_sold: r.qty_sold }))

      // Goods ranks by how much money is sitting idle in a slow mover, not
      // raw qty sold -- 0 units sold on an item with 2 in stock is a
      // curiosity, 0 units sold on an item with 200 in stock (at real cost)
      // is a problem worth acting on. tiedUpValue is what's currently on
      // the shelf at cost; dividing by (qty_sold + 1) means an item that
      // still sells reasonably well, just with leftover stock, ranks well
      // below one that's genuinely not moving. Zero-SOH goods are excluded
      // entirely -- they're out of stock, not unsold. `tier` is purely a
      // relative label (top/middle/bottom third of this list) for an
      // at-a-glance read of how bad each one is next to the others shown.
      const goods = rows
        .filter(r => r.product_type !== 'service' && r.soh > 0)
        .map(r => {
          const tiedUpValue = r.soh * r.unit_cost
          return { id: r.id, name: r.name, soh: r.soh, qty_sold: r.qty_sold, tied_up_value: Math.round(tiedUpValue * 100) / 100, severity_score: tiedUpValue / (r.qty_sold + 1) }
        })
        .sort((a, b) => b.severity_score - a.severity_score || a.name.localeCompare(b.name))
        .slice(0, LIMIT)
        .map((r, i, arr) => ({ ...r, tier: tierFor(i, arr.length) }))

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
