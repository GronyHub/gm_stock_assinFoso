import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name } = body

  const [row] = await sql`
    UPDATE items SET
      canonical_name  = COALESCE(${item_name  ?? null}, canonical_name),
      zoho_item_name  = COALESCE(${item_name  ?? null}, zoho_item_name),
      cf_group        = ${cf_group       ?? null},
      selling_rate    = ${selling_rate   ?? null},
      purchase_rate   = ${purchase_rate  ?? null},
      units_per_pack  = ${units_per_pack ?? null},
      unit_name       = ${unit_name      ?? null}
    WHERE id = ${Number(id)}
    RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(row)
}
