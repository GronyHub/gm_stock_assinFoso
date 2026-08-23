import sql from '@/lib/db'
import { ensureActiveItemsView } from '@/lib/activeItems'
import { ensureGmcColumn } from '@/lib/countRules'

export async function GET() {
  try {
    await Promise.all([ensureActiveItemsView(), ensureGmcColumn()])
    const packs = await sql`
      SELECT
        i.id,
        i.canonical_name as item_name,
        COALESCE(i.gmc_type, '') as gmc_type,
        COALESCE(i.product_type, 'goods') as product_type,
        i.units_per_pack,
        i.converts_to_item_id,
        target.canonical_name as converts_to_name
      FROM active_items i
      LEFT JOIN items target ON target.id = i.converts_to_item_id
      WHERE i.converts_to_item_id IS NOT NULL
        AND (i.gmc_type = 'pack_to_gmc' OR i.gmc_type = 'service_using_gmc')
      ORDER BY i.product_type, i.canonical_name
    `
    return Response.json(packs)
  } catch (e) {
    // Fallback if active_items view is unavailable
    try {
      const packs = await sql`
        SELECT
          i.id,
          i.canonical_name as item_name,
          COALESCE(i.gmc_type, '') as gmc_type,
          COALESCE(i.product_type, 'goods') as product_type,
          i.units_per_pack,
          i.converts_to_item_id,
          target.canonical_name as converts_to_name
        FROM items i
        LEFT JOIN items target ON target.id = i.converts_to_item_id
        WHERE i.converts_to_item_id IS NOT NULL
          AND (i.gmc_type = 'pack_to_gmc' OR i.gmc_type = 'service_using_gmc')
          AND (i.status IS NULL OR LOWER(i.status) != 'inactive')
        ORDER BY i.product_type, i.canonical_name
      `
      return Response.json(packs)
    } catch (fallbackError) {
      return Response.json({ error: 'Failed to fetch GMC packs' }, { status: 500 })
    }
  }
}
