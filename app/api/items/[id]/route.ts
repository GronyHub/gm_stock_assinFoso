import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const [row] = await sql`
      SELECT i.id, i.canonical_name, i.cf_group, i.selling_rate AS selling_price,
             i.purchase_rate, i.units_per_pack, i.unit_name, i.converts_to_item_id,
             COALESCE(s.calculated_soh, 0) AS calculated_soh
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.id = ${Number(id)}
    `
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch {
    const [row] = await sql`
      SELECT id, canonical_name, cf_group, selling_rate AS selling_price, purchase_rate, 0 AS calculated_soh
      FROM items WHERE id = ${Number(id)}
    `
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, converts_to_item_id } = body

  const [row] = await sql`
    UPDATE items SET
      canonical_name      = COALESCE(${item_name  ?? null}, canonical_name),
      zoho_item_name      = COALESCE(${item_name  ?? null}, zoho_item_name),
      cf_group            = ${cf_group       ?? null},
      selling_rate        = ${selling_rate   ?? null},
      purchase_rate       = ${purchase_rate  ?? null},
      units_per_pack      = ${units_per_pack ?? null},
      unit_name           = ${unit_name      ?? null},
      converts_to_item_id = ${converts_to_item_id ?? null}
    WHERE id = ${Number(id)}
    RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, converts_to_item_id
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
