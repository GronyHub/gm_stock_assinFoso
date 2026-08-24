import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { itemCountIntervalLabels, formatCountInterval } from '@/lib/countRules'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const url = new URL(req.url)
  // Every caller (item pickers, aliasing, live sale) fetches this with no
  // limit/offset -- a picker missing an item mid-sale is a live business
  // problem, not just a display gap. Only an explicit ?limit caps it now.
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  try {
    const [rows, intervals] = await Promise.all([
      // items.updated_at doesn't reliably exist (same missing-column class
      // as sales_receipts/bills/staff_times earlier) -- selecting it was
      // silently throwing on every request, sending every caller (item
      // pickers, Live Sale's laws panel, etc.) into the fallback below,
      // which has neither real soh nor count_interval at all.
      sql`
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
               COALESCE(s.calculated_soh, 0) AS soh,
               COALESCE(i.selling_rate, 0) AS selling_price,
               COALESCE(i.purchase_rate, 0) AS cost_price,
               COALESCE(i.product_type, 'goods') AS product_type,
               COALESCE(i.gmc_type, '') AS gmc_type,
               i.converts_to_item_id,
               target.canonical_name AS converts_to_name,
               i.status,
               NOW() AS updated_at
        FROM active_items i
        LEFT JOIN item_stock_summary s ON s.item_id = i.id
        LEFT JOIN items target ON target.id = i.converts_to_item_id
        WHERE LOWER(COALESCE(i.status, '')) != 'service'
        ORDER BY i.canonical_name
        LIMIT ${limit}
        OFFSET ${offset}
      `,
      itemCountIntervalLabels().catch(e => {
        console.error('itemCountIntervalLabels failed, every item will show no count_interval:', e instanceof Error ? e.message : String(e))
        return new Map<number, string>()
      }),
    ])
    if (rows.length === limit) {
      console.warn(`items/all: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    const withIntervals = (rows as { id: number }[]).map(r => ({ ...r, count_interval: formatCountInterval(intervals.get(r.id)) }))
    return NextResponse.json(withIntervals)
  } catch (e) {
    console.error('items/all primary query failed, falling back to items table (no soh/count_interval):', e instanceof Error ? e.message : String(e))
    try {
      const rows = await sql`
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
               0 AS soh,
               COALESCE(i.selling_rate, 0) AS selling_price,
               COALESCE(i.purchase_rate, 0) AS cost_price,
               COALESCE(i.product_type, 'goods') AS product_type,
               COALESCE(i.gmc_type, '') AS gmc_type,
               i.converts_to_item_id,
               target.canonical_name AS converts_to_name,
               i.status,
               NOW() AS updated_at
        FROM items i
        LEFT JOIN items target ON target.id = i.converts_to_item_id
        WHERE (i.status IS NULL OR LOWER(i.status) NOT IN ('inactive','service'))
        ORDER BY i.canonical_name
        LIMIT ${limit}
        OFFSET ${offset}
      `
      if (rows.length === limit) {
        console.warn(`items/all fallback: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
      }
      return NextResponse.json(rows)
    } catch (e) {
      console.error('items/all fallback error:', e)
      return NextResponse.json([])
    }
  }
}
