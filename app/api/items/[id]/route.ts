import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
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

// Renaming an item only ever touched the items row itself -- every place
// that stores its own copy of the name at write time instead of joining
// live (sales_receipt_lines.resolved_name, bill_lines.resolved_name,
// stock_counts.item_name) kept showing the old name until something else
// happened to touch those specific rows, which is why a rename looked
// "half applied" across the app. Backfilling all three here whenever the
// name actually changes closes that gap.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const itemId = Number(id)
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
    WHERE id = ${itemId}
    RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, converts_to_item_id
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (item_name) {
    await sql`UPDATE sales_receipt_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
    await sql`UPDATE bill_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
    await sql`UPDATE stock_counts SET item_name = ${item_name} WHERE item_id = ${itemId}`
  }

  return NextResponse.json(row)
}

// Hard delete -- only Grony/Joe, and only when the item has no real history.
// Everything else (a used-once item, a slightly-wrong duplicate) should be
// merged into another item instead, which preserves the history.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isOwnerLevel(session.user as any)) {
    return NextResponse.json({ error: 'Only Grony or Joe can delete an item' }, { status: 403 })
  }

  const { id } = await params
  const itemId = Number(id)

  const [item] = await sql`SELECT id, canonical_name FROM items WHERE id = ${itemId}`
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [[sales], [bills], [counts], [dependents]] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM sales_receipt_lines WHERE item_id = ${itemId}`,
    sql`SELECT COUNT(*)::int AS n FROM bill_lines WHERE item_id = ${itemId}`,
    sql`SELECT COUNT(*)::int AS n FROM stock_counts WHERE item_id = ${itemId}`,
    sql`SELECT COUNT(*)::int AS n FROM items WHERE converts_to_item_id = ${itemId}`,
  ])

  const blockers: string[] = []
  if (sales.n > 0) blockers.push(`${sales.n} sale line${sales.n !== 1 ? 's' : ''}`)
  if (bills.n > 0) blockers.push(`${bills.n} bill line${bills.n !== 1 ? 's' : ''}`)
  if (counts.n > 0) blockers.push(`${counts.n} stock count${counts.n !== 1 ? 's' : ''}`)
  if (dependents.n > 0) blockers.push(`${dependents.n} other item${dependents.n !== 1 ? 's' : ''} converting into it`)

  if (blockers.length > 0) {
    return NextResponse.json({
      error: `Can't delete "${item.canonical_name}" -- it still has ${blockers.join(', ')}. Merge it into another item instead.`,
    }, { status: 409 })
  }

  await sql`DELETE FROM item_aliases WHERE item_id = ${itemId}`
  await sql`DELETE FROM dismissed_duplicates WHERE item_id1 = ${itemId} OR item_id2 = ${itemId}`
  await sql`DELETE FROM items WHERE id = ${itemId}`

  const actor = (session.user as any)?.username || session.user?.name || 'Unknown'
  await logActivity(actor, 'deleted item', item.canonical_name)

  return NextResponse.json({ ok: true })
}
