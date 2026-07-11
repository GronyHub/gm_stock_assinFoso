import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const rows = await sql`
      SELECT
        i.id,
        i.canonical_name AS item_name,
        i.cf_group,
        i.selling_rate,
        i.purchase_rate,
        i.units_per_pack,
        i.unit_name,
        i.converts_to_item_id,
        COALESCE(i.product_type, 'goods') AS product_type,
        COALESCE(s.calculated_soh, 0) AS calculated_soh
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE LOWER(i.status) != 'inactive'
      ORDER BY i.cf_group NULLS LAST, i.canonical_name
    `
    return NextResponse.json(rows)
  } catch {
    // Fallback if status column is unavailable for any reason
    const rows = await sql`
      SELECT
        i.id,
        i.canonical_name AS item_name,
        i.cf_group,
        i.selling_rate,
        i.purchase_rate,
        i.units_per_pack,
        i.unit_name,
        'goods' AS product_type,
        COALESCE(s.calculated_soh, 0) AS calculated_soh
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      ORDER BY i.cf_group NULLS LAST, i.canonical_name
    `
    return NextResponse.json(rows)
  }
}

export async function POST(req: Request) {
  const body = await req.json()
  const { item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, product_type } = body

  if (!item_name?.trim()) {
    return NextResponse.json({ error: 'item_name required' }, { status: 400 })
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
  return NextResponse.json(row, { status: 201 })
}
