import { requireAuth, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { getCached } from '@/lib/cacheStore'

// Backs Sale mode's 3 read-only "least sales" charts (Services/Goods/
// Groups). One combined all-time qty-sold-per-item query (sales_receipt_lines
// + live_sale_taps, same UNION pattern as /api/analysis/summary's
// topItemsBySales), then sliced/grouped in JS -- cheaper than three separate
// round trips for what's really the same underlying number sorted three
// different ways. Items with zero sales are included (and sort first,
// ascending) since they're the most actionable "least sold" of all.
const LIMIT = 15

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
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
          COALESCE(s.qty, 0)::float AS qty_sold
        FROM items i
        LEFT JOIN sold s ON s.item_id = i.id
        WHERE (i.status IS NULL OR LOWER(i.status) <> 'inactive')
      ` as { id: number; name: string; group: string | null; product_type: string | null; qty_sold: number }[]

      const byQtyAsc = (a: { qty_sold: number; name: string }, b: { qty_sold: number; name: string }) =>
        a.qty_sold - b.qty_sold || a.name.localeCompare(b.name)

      const services = rows
        .filter(r => r.product_type === 'service')
        .sort(byQtyAsc)
        .slice(0, LIMIT)
        .map(r => ({ id: r.id, name: r.name, qty_sold: r.qty_sold }))

      const goods = rows
        .filter(r => r.product_type !== 'service')
        .sort(byQtyAsc)
        .slice(0, LIMIT)
        .map(r => ({ id: r.id, name: r.name, qty_sold: r.qty_sold }))

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
