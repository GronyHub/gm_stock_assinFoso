import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { ensureCountCadenceColumns, ensureGmcColumn, itemCountIntervalLabels, formatCountInterval } from '@/lib/countRules'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const itemId = Number(id)
  try {
    await Promise.all([ensureCountCadenceColumns(), ensureGmcColumn()])
    const [[row], intervals] = await Promise.all([
      sql`
        SELECT i.id, i.canonical_name, i.cf_group, i.selling_rate AS selling_price,
               i.purchase_rate, i.units_per_pack, i.unit_name, i.converts_to_item_id,
               i.count_excluded, i.count_cadence_days, i.count_excluded_reason,
               COALESCE(s.calculated_soh, 0) AS calculated_soh, COALESCE(i.gmc_type, '') AS gmc_type,
               COALESCE(i.product_type, 'goods') AS product_type
        FROM items i
        LEFT JOIN item_stock_summary s ON s.item_id = i.id
        WHERE i.id = ${itemId}
      `,
      // The edit form's "Count every" field has no way to show what the
      // item's cadence currently resolves to without this -- shares the
      // exact same computation items/all uses, just picking out one item,
      // so the label here can never drift out of sync with the bulk view.
      itemCountIntervalLabels().catch(() => new Map<number, string>()),
    ])
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ...row, count_interval: formatCountInterval(intervals.get(itemId)) })
  } catch {
    const [row] = await sql`
      SELECT id, canonical_name, cf_group, selling_rate AS selling_price, purchase_rate, 0 AS calculated_soh, COALESCE(is_gmc, false) AS is_gmc
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
//
// Several real callers intentionally send a partial body -- e.g. the Sales
// tab's cost-price editor sends only { purchase_rate }, ItemsTab's quick
// group reassignment sends only { cf_group } -- relying on every other
// field staying untouched. Previously every field but item_name used
// `${field ?? null}` directly, which nulled out anything the caller didn't
// include (indistinguishable from an explicit null), silently wiping the
// rest of that item's data on every partial save. Reading the current row
// first and only overriding keys actually present in the body -- via
// hasOwnProperty, so an explicit null still clears a field the caller does
// include -- fixes that while keeping the "clear this field" behavior the
// full edit forms (ItemsTab/LossTab) rely on when a field is left blank.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const itemId = Number(id)
  const body = await req.json()
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

  await Promise.all([ensureCountCadenceColumns(), ensureGmcColumn()])
  const [current] = await sql`
    SELECT i.canonical_name, i.cf_group, i.selling_rate, i.purchase_rate, i.units_per_pack, i.unit_name, i.converts_to_item_id, i.product_type,
           i.count_excluded, i.count_cadence_days, i.count_excluded_reason, COALESCE(i.gmc_type, '') AS gmc_type,
           COALESCE(s.calculated_soh, 0) AS calculated_soh
    FROM items i
    LEFT JOIN item_stock_summary s ON s.item_id = i.id
    WHERE i.id = ${itemId}
  `
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const item_name           = has('item_name') ? body.item_name : undefined
  const cf_group            = has('cf_group') ? body.cf_group : current.cf_group
  const selling_rate        = has('selling_rate') ? body.selling_rate : current.selling_rate
  const purchase_rate       = has('purchase_rate') ? body.purchase_rate : current.purchase_rate
  const units_per_pack      = has('units_per_pack') ? body.units_per_pack : current.units_per_pack
  const unit_name           = has('unit_name') ? body.unit_name : current.unit_name
  const converts_to_item_id = has('converts_to_item_id') ? body.converts_to_item_id : current.converts_to_item_id
  const product_type        = has('product_type') ? (body.product_type === 'service' ? 'service' : 'goods') : current.product_type
  const gmc_type            = has('gmc_type') ? body.gmc_type : current.gmc_type
  // count_cadence_days genuinely needs a real null to mean "back to
  // automatic" (see /api/stock/gmc-weekly and overdue, which COALESCE
  // this against the computed 7/15/30-day default) -- so, like every
  // other field here, an omitted key falls back to the current value at
  // the JS level rather than via SQL COALESCE, which would treat an
  // explicit null the same as "not sent" and never let it clear.
  const count_excluded      = has('count_excluded') ? !!body.count_excluded : current.count_excluded
  const count_cadence_days  = has('count_cadence_days') ? body.count_cadence_days : current.count_cadence_days
  // A reason only ever means something while the item is actually excluded
  // -- forced back to null the moment count_excluded is false so a
  // re-included item can't carry a stale "why it was excluded" note that no
  // longer applies.
  const count_excluded_reason = count_excluded
    ? (has('count_excluded_reason') ? (body.count_excluded_reason || null) : current.count_excluded_reason)
    : null

  // An excluded item is meant for stock that's genuinely gone for good
  // (discontinued, off the market) -- excluding one that still has real
  // stock on hand would hide it from every count queue while the shelf
  // still has it, with nothing left to catch the drift. Checked server-side
  // (not just in the form) since this is the one thing a stale client
  // can't be trusted to enforce correctly.
  if (count_excluded && Math.abs(parseFloat(current.calculated_soh) || 0) > 0.001) {
    return NextResponse.json({
      error: `Can't exclude "${current.canonical_name}" from counts -- it still shows ${current.calculated_soh} in stock. Bring it to 0 first (a count, or a sale/bill that clears it out).`,
    }, { status: 400 })
  }

  const [row] = await sql`
    UPDATE items SET
      canonical_name      = COALESCE(${item_name  ?? null}, canonical_name),
      zoho_item_name      = COALESCE(${item_name  ?? null}, zoho_item_name),
      cf_group            = ${cf_group       ?? null},
      selling_rate        = ${selling_rate   ?? null},
      purchase_rate       = ${purchase_rate  ?? null},
      units_per_pack      = ${units_per_pack ?? null},
      unit_name           = ${unit_name      ?? null},
      converts_to_item_id = ${converts_to_item_id ?? null},
      product_type        = ${product_type   ?? 'goods'},
      gmc_type            = ${gmc_type       ?? ''},
      count_excluded      = ${count_excluded ?? false},
      count_cadence_days  = ${count_cadence_days ?? null},
      count_excluded_reason = ${count_excluded_reason}
    WHERE id = ${itemId}
    RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, converts_to_item_id, product_type, gmc_type,
              count_excluded, count_cadence_days, count_excluded_reason
  `
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Callers editing the cadence (ItemEditForm's "Count every" field) need
  // the freshly-resolved label back to patch their own item list in place --
  // without this they either show the pre-edit label until their next full
  // reload, or (worse) never re-fetch at all and look like the save silently
  // did nothing. Same computation GET above uses, so it can't drift.
  const intervals = await itemCountIntervalLabels().catch(() => new Map<number, string>())
  const count_interval = formatCountInterval(intervals.get(itemId))

  if (item_name && item_name !== current.canonical_name) {
    // Keep the old name resolvable -- a future sale/bill line still typed
    // with the old spelling should still auto-match this item instead of
    // landing in Unresolved. Same thing mergeItems.ts already does when a
    // merge renames the winner.
    await sql`
      INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
      VALUES (${itemId}, ${current.canonical_name}, 'canonical', 'rename')
      ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
    `
    await sql`UPDATE sales_receipt_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
    await sql`UPDATE bill_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
    await sql`UPDATE stock_counts SET item_name = ${item_name} WHERE item_id = ${itemId}`
  }

  return NextResponse.json({ ...row, count_interval })
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
