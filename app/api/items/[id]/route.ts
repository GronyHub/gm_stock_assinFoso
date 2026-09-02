import { requireAuth, badRequest, notFound, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { isOwnerLevel } from '@/lib/roles'
import { ensureCountCadenceColumns, ensureGmcColumn, ensureUnitTimeColumn, ensureDerivedFromColumn, itemCountIntervalLabels, formatCountInterval } from '@/lib/countRules'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const itemId = Number(id)
  try {
    await Promise.all([ensureCountCadenceColumns(), ensureGmcColumn(), ensureUnitTimeColumn(), ensureDerivedFromColumn()])
    const [[row], intervals] = await Promise.all([
      sql`
        SELECT i.id, i.canonical_name, i.cf_group, i.selling_rate AS selling_price,
               i.purchase_rate, i.units_per_pack, i.unit_name, i.converts_to_item_id, i.derived_from_item_id,
               i.count_excluded, i.count_cadence_days, i.count_excluded_reason, i.unit_time_seconds,
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
    if (!row) return notFound()
    return success({ ...row, count_interval: formatCountInterval(intervals.get(itemId)) })
  } catch {
    const [row] = await sql`
      SELECT id, canonical_name, cf_group, selling_rate AS selling_price, purchase_rate, 0 AS calculated_soh, COALESCE(is_gmc, false) AS is_gmc
      FROM items WHERE id = ${Number(id)}
    `
    if (!row) return notFound()
    return success(row)
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
// Several real callers intentionally send a partial body -- e.g. BillsTab's
// New SP cell sends only { selling_rate }, ItemsTab's quick group
// reassignment sends only { cf_group } -- relying on every other field
// staying untouched. (VCP itself no longer comes through here at all --
// lib/vcpSync.ts updates items.purchase_rate directly via SQL after a bill
// changes.) Previously every field but item_name used
// `${field ?? null}` directly, which nulled out anything the caller didn't
// include (indistinguishable from an explicit null), silently wiping the
// rest of that item's data on every partial save. Reading the current row
// first and only overriding keys actually present in the body -- via
// hasOwnProperty, so an explicit null still clears a field the caller does
// include -- fixes that while keeping the "clear this field" behavior the
// full edit forms (ItemsTab/LossTab) rely on when a field is left blank.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error

  try {
    const { id } = await params
    const itemId = Number(id)
    const body = await req.json()
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)

    await Promise.all([ensureCountCadenceColumns(), ensureGmcColumn(), ensureUnitTimeColumn(), ensureDerivedFromColumn()])
    const [current] = await sql`
      SELECT i.canonical_name, i.cf_group, i.selling_rate, i.purchase_rate, i.units_per_pack, i.unit_name, i.converts_to_item_id, i.product_type,
             i.count_excluded, i.count_cadence_days, i.count_excluded_reason, i.unit_time_seconds, COALESCE(i.gmc_type, '') AS gmc_type,
             i.derived_from_item_id,
             COALESCE(s.calculated_soh, 0) AS calculated_soh
      FROM items i
      LEFT JOIN item_stock_summary s ON s.item_id = i.id
      WHERE i.id = ${itemId}
    `
    if (!current) return notFound()

    const item_name           = has('item_name') ? body.item_name : undefined
    const cf_group            = has('cf_group') ? body.cf_group : current.cf_group
    const selling_rate        = has('selling_rate') ? body.selling_rate : current.selling_rate
    const units_per_pack      = has('units_per_pack') ? body.units_per_pack : current.units_per_pack
    const unit_name           = has('unit_name') ? body.unit_name : current.unit_name
    const unit_time_seconds   = has('unit_time_seconds') ? body.unit_time_seconds : current.unit_time_seconds
    const converts_to_item_id = has('converts_to_item_id') ? body.converts_to_item_id : current.converts_to_item_id
    const derived_from_item_id = has('derived_from_item_id') ? body.derived_from_item_id : current.derived_from_item_id
    const product_type        = has('product_type') ? (body.product_type === 'service' ? 'service' : 'goods') : current.product_type
    const gmc_type            = has('gmc_type') ? body.gmc_type : current.gmc_type
    const count_excluded      = has('count_excluded') ? !!body.count_excluded : current.count_excluded
    const count_cadence_days  = has('count_cadence_days') ? body.count_cadence_days : current.count_cadence_days
    const count_excluded_reason = count_excluded
      ? (has('count_excluded_reason') ? (body.count_excluded_reason || null) : current.count_excluded_reason)
      : null

    // Auto-calculate cost price from parent pack: parent_selling_price / units_per_pack
    let purchase_rate = has('purchase_rate') ? body.purchase_rate : current.purchase_rate
    if (derived_from_item_id) {
      try {
        const [parent] = await sql`SELECT selling_rate FROM items WHERE id = ${derived_from_item_id}`
        if (parent && parent.selling_rate != null && units_per_pack) {
          const parentPrice = parseFloat(String(parent.selling_rate)) || 0
          const perUnit = parseFloat(String(units_per_pack)) || 1
          purchase_rate = parentPrice / perUnit
        }
      } catch (e) {
        console.warn('Failed to calculate derived cost price:', e)
      }
    }

    if (count_excluded && Math.abs(parseFloat(current.calculated_soh) || 0) > 0.001) {
      return badRequest(`Can't exclude "${current.canonical_name}" from counts -- it still shows ${current.calculated_soh} in stock. Bring it to 0 first (a count, or a sale/bill that clears it out).`)
    }

    if (has('converts_to_item_id') && converts_to_item_id) {
      try {
        const [targetItem] = await sql`
          SELECT id, canonical_name, gmc_type, product_type FROM items WHERE id = ${converts_to_item_id}
        `.catch(() => [])
        if (!targetItem) {
          return badRequest('Selected item does not exist')
        }
        const newGmcType = gmc_type || current.gmc_type
        if ((newGmcType === 'service_using_gmc' || newGmcType === 'pack_to_gmc') &&
            !['gmc', 'service_no_gmc'].includes(targetItem.gmc_type || '')) {
          return badRequest(`"${targetItem.canonical_name}" is not compatible -- it must be marked as GMC or Service (no GMC)`)
        }
      } catch (e) {
        console.error('Failed to validate conversion target:', e)
      }
    }

    // A service using GMC can never carry a cost price (see
    // add-service-gmc-constraints's DB trigger) -- force it null here rather
    // than trusting whatever purchase_rate happens to already be sitting on
    // the row. Without this, an item left with a stale non-null (even a
    // literal 0) cost price from before that trigger existed blocks *every*
    // future edit to it, not just an attempt to change the cost price
    // itself, since a full-row UPDATE re-submits the unchanged column too.
    const finalPurchaseRate = gmc_type === 'service_using_gmc' ? null : purchase_rate

    const [row] = await sql`
      UPDATE items SET
        canonical_name      = COALESCE(${item_name  ?? null}, canonical_name),
        zoho_item_name      = COALESCE(${item_name  ?? null}, zoho_item_name),
        cf_group            = ${cf_group       ?? null},
        selling_rate        = ${selling_rate   ?? null},
        purchase_rate       = ${purchase_rate ?? null},
        units_per_pack      = ${units_per_pack ?? null},
        unit_name           = ${unit_name      ?? null},
        unit_time_seconds   = ${unit_time_seconds ?? null},
        converts_to_item_id = ${converts_to_item_id ?? null},
        derived_from_item_id = ${derived_from_item_id ?? null},
        product_type        = ${product_type   ?? 'goods'},
        gmc_type            = ${gmc_type       ?? ''},
        count_excluded      = ${count_excluded ?? false},
        count_cadence_days  = ${count_cadence_days ?? null},
        count_excluded_reason = ${count_excluded_reason}
      WHERE id = ${itemId}
      RETURNING id, canonical_name AS item_name, cf_group, selling_rate, purchase_rate, units_per_pack, unit_name, unit_time_seconds, converts_to_item_id, derived_from_item_id, product_type, gmc_type,
                count_excluded, count_cadence_days, count_excluded_reason
    `
    if (!row) return notFound()

    const intervals = await itemCountIntervalLabels().catch(() => new Map<number, string>())
    const count_interval = formatCountInterval(intervals.get(itemId))

    if (item_name && item_name !== current.canonical_name) {
      await sql`
        INSERT INTO item_aliases (item_id, alias_name, alias_type, source)
        VALUES (${itemId}, ${current.canonical_name}, 'canonical', 'rename')
        ON CONFLICT (item_id, alias_name, alias_type) DO NOTHING
      `
      await sql`UPDATE sales_receipt_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
      await sql`UPDATE bill_lines SET resolved_name = ${item_name} WHERE item_id = ${itemId}`
      await sql`UPDATE stock_counts SET item_name = ${item_name} WHERE item_id = ${itemId}`
    }

    return success({ ...row, count_interval })
  } catch (error) {
    return handleError('items PUT', error)
  }
}

// Hard delete -- only Grony/Joe, and only when the item has no real history.
// Everything else (a used-once item, a slightly-wrong duplicate) should be
// merged into another item instead, which preserves the history.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) {
    return badRequest('Only Grony or Joe can delete an item')
  }

  try {
    const { id } = await params
    const itemId = Number(id)

    const [item] = await sql`SELECT id, canonical_name FROM items WHERE id = ${itemId}`
    if (!item) return notFound()

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
      return badRequest(`Can't delete "${item.canonical_name}" -- it still has ${blockers.join(', ')}. Merge it into another item instead.`)
    }

    await sql`DELETE FROM item_aliases WHERE item_id = ${itemId}`
    await sql`DELETE FROM dismissed_duplicates WHERE item_id1 = ${itemId} OR item_id2 = ${itemId}`
    await sql`DELETE FROM items WHERE id = ${itemId}`

    const actor = (session?.user as any)?.username || session?.user?.name || 'Unknown'
    await logActivity(actor, 'deleted item', item.canonical_name)

    return success({ ok: true })
  } catch (error) {
    return handleError('items DELETE', error)
  }
}
