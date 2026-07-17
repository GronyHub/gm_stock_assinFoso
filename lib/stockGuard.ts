import sql from '@/lib/db'

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
