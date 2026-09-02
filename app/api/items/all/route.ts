import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { itemCountIntervalLabels, formatCountInterval, ensureUnitTimeColumn, ensureDerivedFromColumn } from '@/lib/countRules'
import { ensureAdjustedCostPriceColumn } from '@/lib/vcpSync'
import { NextResponse, NextRequest } from 'next/server'

// Cache for default items request (no limit/offset)
let cachedItems: any = null
let cachedItemsTime: number = 0
const CACHE_TTL = 2 * 60 * 60 * 1000 // 2 hours

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  // Return cached data if using defaults and cache is fresh
  const now = Date.now()
  if (limit === 50000 && offset === 0 && cachedItems && now - cachedItemsTime < CACHE_TTL) {
    return NextResponse.json(cachedItems)
  }

  try {
    await Promise.all([ensureUnitTimeColumn(), ensureAdjustedCostPriceColumn(), ensureDerivedFromColumn()])
    const [rows, intervals] = await Promise.all([
      sql`
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
               COALESCE(s.calculated_soh, 0) AS soh,
               COALESCE(i.selling_rate, 0) AS selling_price,
               COALESCE(i.purchase_rate, 0) AS cost_price,
               COALESCE(i.adjusted_cost_price, i.purchase_rate, 0) AS acp_price,
               COALESCE(i.product_type, 'goods') AS product_type,
               COALESCE(i.gmc_type, '') AS gmc_type,
               i.converts_to_item_id,
               target.canonical_name AS converts_to_name,
               i.derived_from_item_id,
               COALESCE(i.units_per_pack, 1) AS units_per_pack,
               i.unit_time_seconds,
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

    // Cache default request
    if (limit === 50000 && offset === 0) {
      cachedItems = withIntervals
      cachedItemsTime = now
    }

    return NextResponse.json(withIntervals)
  } catch (e) {
    console.error('items/all primary query failed, falling back to items table (no soh/count_interval):', e instanceof Error ? e.message : String(e))
    try {
      const rows = await sql`
        SELECT i.id, i.canonical_name AS name, i.cf_group AS "group",
               0 AS soh,
               COALESCE(i.selling_rate, 0) AS selling_price,
               COALESCE(i.purchase_rate, 0) AS cost_price,
               COALESCE(i.adjusted_cost_price, i.purchase_rate, 0) AS acp_price,
               COALESCE(i.product_type, 'goods') AS product_type,
               COALESCE(i.gmc_type, '') AS gmc_type,
               i.converts_to_item_id,
               target.canonical_name AS converts_to_name,
               i.derived_from_item_id,
               COALESCE(i.units_per_pack, 1) AS units_per_pack,
               i.unit_time_seconds,
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

      // Cache default request
      if (limit === 50000 && offset === 0) {
        cachedItems = rows
        cachedItemsTime = now
      }

      return NextResponse.json(rows)
    } catch (e) {
      console.error('items/all fallback error:', e)
      return NextResponse.json([])
    }
  }
}
