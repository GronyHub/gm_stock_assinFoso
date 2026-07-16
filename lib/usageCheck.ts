import sql from '@/lib/db'

// Detects "impossible usage" on conversion-target items (e.g. 4x6 single
// papers): more recorded as used since the last physical count than could
// have existed given what was counted plus everything received (bills and
// GMC pack conversions). That combination means a pack was physically
// opened without a GMC record -- e.g. 7 papers used while only 3 were
// counted and no pack was taken on GMC.
export async function impossibleUsageWarnings(date: string): Promise<string[]> {
  const warnings: string[] = []
  try {
    const targets = await sql`
      SELECT DISTINCT t.id, t.canonical_name
      FROM items src
      JOIN items t ON t.id = src.converts_to_item_id
    `

    for (const t of targets) {
      // Last physical count strictly before this receipt's date -- the day's
      // own count is a closing count, so it can't vouch for the day's usage.
      const [c0] = await sql`
        SELECT count_date::date::text AS d, SUM(quantity_counted) AS qty
        FROM stock_counts
        WHERE item_id = ${t.id} AND count_date::date < ${date}
        GROUP BY count_date::date
        ORDER BY count_date::date DESC
        LIMIT 1
      `
      if (!c0) continue

      const [flows] = await sql`
        SELECT
          COALESCE((
            SELECT SUM(bl.quantity) FROM bill_lines bl
            JOIN bills b ON b.id = bl.bill_id
            WHERE bl.item_id = ${t.id}
              AND b.bill_date::date > ${c0.d} AND b.bill_date::date <= ${date}
          ), 0) AS bills,
          COALESCE((
            SELECT SUM(srl.quantity * COALESCE(src.units_per_pack, 1))
            FROM sales_receipt_lines srl
            JOIN sales_receipts sr ON sr.id = srl.receipt_id
            JOIN items src ON src.id = srl.item_id
            WHERE src.converts_to_item_id = ${t.id}
              AND COALESCE(src.product_type, 'goods') <> 'service'
              AND sr.customer_name = 'Grony Multimedia as Customer'
              AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
          ), 0) AS conv_in,
          COALESCE((
            SELECT SUM(srl.quantity)
            FROM sales_receipt_lines srl
            JOIN sales_receipts sr ON sr.id = srl.receipt_id
            WHERE srl.item_id = ${t.id}
              AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
          ), 0) AS direct_used,
          COALESCE((
            SELECT SUM(srl.quantity * COALESCE(src.units_per_pack, 1))
            FROM sales_receipt_lines srl
            JOIN sales_receipts sr ON sr.id = srl.receipt_id
            JOIN items src ON src.id = srl.item_id
            WHERE src.converts_to_item_id = ${t.id}
              AND src.product_type = 'service'
              AND (sr.customer_name IS NULL OR sr.customer_name <> 'Grony Multimedia as Customer')
              AND sr.receipt_date::date > ${c0.d} AND sr.receipt_date::date <= ${date}
          ), 0) AS service_used
      `

      const counted = parseFloat(c0.qty) || 0
      const received = (parseFloat(flows.bills) || 0) + (parseFloat(flows.conv_in) || 0)
      const available = counted + received
      const used = (parseFloat(flows.direct_used) || 0) + (parseFloat(flows.service_used) || 0)

      if (used > available + 0.001) {
        const fmt = (n: number) => n % 1 === 0 ? String(n) : n.toFixed(2)
        warnings.push(
          `⚠️ ${t.canonical_name}: ${fmt(used)} recorded as used since the last count, but only ${fmt(available)} were available `
          + `(${fmt(counted)} counted on ${c0.d}${received > 0 ? `, +${fmt(received)} received since` : ' and no pack taken on GMC since'}). `
          + `That is not possible — a pack was probably opened without recording it on GMC. Please record the missing GMC pack.`
        )
      }
    }
  } catch (e) {
    console.error('impossibleUsageWarnings error (non-fatal):', e)
  }
  return warnings
}
