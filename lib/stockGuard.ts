import sql from '@/lib/db'

// Named pack-chains where counting the singles side should also prompt (or,
// for A4 Brown Envelope/A4 Lamination/4x6, require) a same-day count of the
// pack side too -- a pack can otherwise sit open through an entire
// USED/PACK cycle overrun with nobody noticing (see the 17th June A4 Brown
// Envelope case). Matched by name since this is a small, named set of
// chains, not a rule for every pack item. Matching a PACK item's own name
// is harmless: the "does anything convert into this item" check below
// naturally excludes it, since nothing converts into a pack.
// Exported so lib/countRules.ts can pull the blocking chains' packs into
// the daily count list itself, not just prompt for them reactively when
// the singles side is saved.
export const PACK_PAIRING_CHAINS: { match: RegExp; blocking: boolean }[] = [
  { match: /a4\s*brown\s*envelope/i, blocking: true },
  { match: /a4\s*lamination/i, blocking: true },
  { match: /4x6/i, blocking: true },
  { match: /a4\s*sheet/i, blocking: false },
]

export type PackPairingResult = { blocking: boolean; packs: { id: number; name: string }[] }

// Null when this item isn't the singles side of a named chain, the chain
// isn't actually wired up (converts_to_item_id) yet, or one of its packs
// already has a count for this date.
export async function packPairingCheck(itemId: number, itemName: string, date: string): Promise<PackPairingResult | null> {
  const chain = PACK_PAIRING_CHAINS.find(c => c.match.test(itemName))
  if (!chain) return null
  try {
    const packs = await sql`
      SELECT id, canonical_name FROM items WHERE converts_to_item_id = ${itemId}
    ` as { id: number; canonical_name: string }[]
    if (!packs.length) return null

    const packIds = packs.map(p => p.id)
    const counted = await sql`
      SELECT 1 FROM stock_counts
      WHERE item_id = ANY(${packIds}) AND count_date::date = ${date}
      LIMIT 1
    `
    if (counted.length > 0) return null

    return { blocking: chain.blocking, packs: packs.map(p => ({ id: p.id, name: p.canonical_name })) }
  } catch (e) {
    console.error('packPairingCheck failed (allowing entry):', e)
    return null
  }
}

// Expected stock of an item on a given date, from records alone: the last
// count strictly before that date, plus purchases (bills) and pack
// conversions credited in since, minus everything recorded as used/sold
// (its own sales lines and any services that consume it). Returns null when
// there's no earlier count to anchor on (nothing to judge against).
export async function expectedStockAt(itemId: number, date: string): Promise<number | null> {
  const [c0] = await sql`
    SELECT count_date::date::text AS d, SUM(quantity_counted) AS qty
    FROM stock_counts
    WHERE item_id = ${itemId} AND count_date::date < ${date}
    GROUP BY count_date::date
    ORDER BY count_date::date DESC
    LIMIT 1
  `
  if (!c0) return null

  const [flows] = await sql`
    SELECT
      COALESCE((
        SELECT SUM(bl.quantity) FROM bill_lines bl
        JOIN bills b ON b.id = bl.bill_id
        WHERE bl.item_id = ${itemId}
          AND b.bill_date::date > ${c0.d} AND b.bill_date::date <= ${date}
      ), 0) AS bills,
      COALESCE((
        SELECT SUM(srl.quantity * COALESCE(src.units_per_pack, 1))
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        JOIN items src ON src.id = srl.item_id
        WHERE src.converts_to_item_id = ${itemId}
          AND COALESCE(src.product_type, 'goods') <> 'service'
          AND sr.customer_name = 'Grony Multimedia as Customer'
          AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
      ), 0) AS conv_in,
      COALESCE((
        SELECT SUM(srl.quantity)
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        WHERE srl.item_id = ${itemId}
          AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
      ), 0) AS direct_used,
      COALESCE((
        SELECT SUM(srl.quantity * COALESCE(src.units_per_pack, 1))
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        JOIN items src ON src.id = srl.item_id
        WHERE src.converts_to_item_id = ${itemId}
          AND src.product_type = 'service'
          AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
          AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
      ), 0) AS service_used
  `

  const expected = (parseFloat(c0.qty) || 0)
    + (parseFloat(flows.bills) || 0)
    + (parseFloat(flows.conv_in) || 0)
    - (parseFloat(flows.direct_used) || 0)
    - (parseFloat(flows.service_used) || 0)
  return parseFloat(expected.toFixed(4))
}

// Hard guard on GAINS: counting more than the records can explain is not
// allowed -- a gain always means a missing record (bill or GMC not entered).
// Returns an error message, or null when the count is acceptable.
export async function gainViolation(itemId: number, qty: number, date: string): Promise<string | null> {
  try {
    const expected = await expectedStockAt(itemId, date)
    if (expected === null) return null // no earlier count -- nothing to judge against
    const gain = parseFloat((qty - expected).toFixed(4))
    if (gain > 0.001) {
      return `Not allowed — counting ${qty} would create a gain of +${gain}: the records only support ${Math.max(0, expected)} `
        + `(last count + purchases + GMC conversions − sales). Extra stock on the shelf means a bill or GMC record is missing: enter that first, then count.`
    }
    return null
  } catch (e) {
    console.error('gainViolation check failed (allowing entry):', e)
    return null
  }
}

// Hard guard: no entry may drive an item's stock on hand below zero. You
// cannot sell or take what the records say the shop doesn't have -- if the
// shelf really has it, a bill or GMC record is missing and must be entered
// first. deltas = item_id -> quantity this entry REMOVES from stock (net,
// so edits pass newQty - oldQty).
export async function negativeStockViolations(deltas: Map<number, number>): Promise<string[]> {
  const ids = Array.from(deltas.keys()).filter(id => Number.isFinite(id))
  if (ids.length === 0) return []

  let rows: any[] = []
  try {
    rows = await sql`
      SELECT s.item_id, s.item_name, s.calculated_soh, i.product_type
      FROM item_stock_summary s
      LEFT JOIN items i ON i.id = s.item_id
      WHERE s.item_id = ANY(${ids})
    `
  } catch (e) {
    console.error('negativeStockViolations lookup failed (allowing entry):', e)
    return []
  }

  const msgs: string[] = []
  for (const r of rows) {
    if (r.product_type === 'service') continue // services have no stock
    const delta = deltas.get(r.item_id) ?? 0
    if (delta <= 0) continue // adding stock back or unchanged -- always fine
    const soh = parseFloat(r.calculated_soh ?? '0') || 0
    const after = parseFloat((soh - delta).toFixed(4))
    if (after < -0.001) {
      msgs.push(
        `"${r.item_name}" has only ${soh} in stock but this entry takes ${delta} — stock would go to ${after}. `
        + `If the shop really has it, a bill or GMC record is missing: enter that first, then record this.`
      )
    }
  }
  return msgs
}
