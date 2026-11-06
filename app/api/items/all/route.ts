import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { itemCountIntervalLabels, formatCountInterval, ensureUnitTimeColumn, ensureDerivedFromColumn } from '@/lib/countRules'
import { ensureAdjustedCostPriceColumn } from '@/lib/vcpSync'
import { getGmcTargetSohMap } from '@/lib/gmcStock'
import { ensureItemPictureColumn } from '@/lib/itemPictures'
import { getItemsCache, setItemsCache } from '@/lib/itemsCache'
import { NextResponse, NextRequest } from 'next/server'


// The bulk catalogue above is cached for 2 hours to control Neon compute
// cost, but a GMC conversion target's SOH must never lag that long -- it's
// exactly what a staff member checks right after tapping a new pack. Splice
// the correct (pack-reset-aware, see lib/gmcStock.ts) value over the plain
// item_stock_summary.calculated_soh on every request, cache hit or not --
// only ~14 items ever match, so this is cheap even on a cache hit.
async function withFreshGmcSoh(items: any[]): Promise<any[]> {
  const gmcMap = await getGmcTargetSohMap()
  if (gmcMap.size === 0) return items
  return items.map(item => gmcMap.has(item.id) ? { ...item, soh: gmcMap.get(item.id) } : item)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50000, 50000)
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

  // Return cached data if using defaults and cache is fresh
  const cached = limit === 50000 && offset === 0 ? getItemsCache() : null
  if (cached) return NextResponse.json(await withFreshGmcSoh(cached as any[]))

  try {
    await Promise.all([ensureUnitTimeColumn(), ensureAdjustedCostPriceColumn(), ensureDerivedFromColumn(), ensureItemPictureColumn()])
    const rows = await sql`
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
             i.unit_time_seconds, i.image_url,
             COALESCE(i.needs_review, false) AS needs_review,
             NOW() AS updated_at
      FROM active_items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      LEFT JOIN items target ON target.id = i.converts_to_item_id
      WHERE LOWER(COALESCE(i.status, '')) != 'service'
      ORDER BY i.canonical_name
      LIMIT ${limit}
      OFFSET ${offset}
    `
    if (rows.length === limit) {
      console.warn(`items/all: hit the ${limit}-row cap -- results may be truncated, raise the cap`)
    }
    const withoutIntervals = rows as { id: number }[]

    // Cache default request (WITHOUT count_interval to avoid blocking on expensive computation)
    if (limit === 50000 && offset === 0) {
      setItemsCache(withoutIntervals)
    }

    return NextResponse.json(await withFreshGmcSoh(withoutIntervals))
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
               COALESCE(i.needs_review, false) AS needs_review,
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

      // Deliberately NOT cached: this fallback has no stock figures (soh is a placeholder 0), so keeping it
      // would show every item as 0 pc until the cache expired.

      return NextResponse.json(await withFreshGmcSoh(rows))
    } catch (e) {
      console.error('items/all fallback error:', e)
      return NextResponse.json([])
    }
  }
}
