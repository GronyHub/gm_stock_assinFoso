import { badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { ensureActiveItemsView } from '@/lib/activeItems'
import { ensureGmcColumn, ensureDerivedFromColumn } from '@/lib/countRules'

export async function GET() {
  try {
    await Promise.all([ensureActiveItemsView(), ensureGmcColumn(), ensureDerivedFromColumn()])
    const rows = await sql`
      SELECT
        i.id,
        i.canonical_name AS item_name,
        COALESCE(i.cf_group, s.cf_group) AS cf_group,
        i.selling_rate,
        i.purchase_rate,
        i.units_per_pack,
        i.unit_name,
        i.converts_to_item_id,
        i.derived_from_item_id,
        COALESCE(i.product_type, 'goods') AS product_type,
        COALESCE(s.calculated_soh, 0) AS calculated_soh,
        COALESCE(i.gmc_type, '') AS gmc_type
      FROM active_items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      ORDER BY cf_group NULLS LAST, i.canonical_name
    `
    return success(rows)
  } catch {
    // Fallback if status column is unavailable for any reason
    const rows = await sql`
      SELECT
        i.id,
        i.canonical_name AS item_name,
        COALESCE(i.cf_group, s.cf_group) AS cf_group,
        i.selling_rate,
        i.purchase_rate,
        i.units_per_pack,
        i.unit_name,
        i.derived_from_item_id,
        'goods' AS product_type,
        COALESCE(s.calculated_soh, 0) AS calculated_soh,
        COALESCE(i.gmc_type, '') AS gmc_type
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.status IS NULL OR LOWER(i.status) != 'inactive'
      ORDER BY cf_group NULLS LAST, i.canonical_name
    `
    return success(rows)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, product_type } = body

  if (!item_name?.trim()) {
    return badRequest('item_name required')
  }

  const type = product_type === 'service' ? 'service' : 'goods'

  const [row] = await sql`
    INSERT INTO items (zoho_item_id, zoho_item_name, canonical_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, product_type, source)
    VALUES (
      ${'INTERNAL_' + item_name.trim().toUpperCase().replace(/\s+/g, '_')},
      ${item_name.trim()},
      ${item_name.trim()},
      ${cf_group || null},
      ${selling_rate || null},
      ${purchase_rate || null},
      ${units_per_pack || null},
      ${unit_name || null},
      ${type},
      'internal'
    )
    RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, product_type
  `
  return success(row)
}
